from __future__ import annotations

import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, wait as wait_futures
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, computed_field

from agents.gemini_client import GenerationInfo
from agents.language_agent import LanguageAgent
from agents.retriever_agent import RetrieverAgent
from data_ingestion.api_agent import APIAgent
from data_ingestion.scrapping_agent import ScrapingAgent
from data_ingestion.nse_market_service import (
    NSEMarketDataService,
    StockHistory,
    StockQuote,
    get_nse_service,
    is_nse_symbol,
)
from data_ingestion.nse_mcp_client import nse_mcp_enabled
from backend.currency import NSE_SOURCE_LABEL, resolve_currency
from backend.market_cap import classify_market_cap
from backend.workflow_state import WorkflowState, WorkflowStep

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TechnicalIndicators(BaseModel):
    model_config = ConfigDict(extra="ignore")
    latest_close: Optional[float] = None
    change_percent: Optional[float] = None
    moving_average_20: Optional[float] = None
    moving_average_50: Optional[float] = None
    average_volume_20: Optional[float] = None
    high_52_week: Optional[float] = None
    low_52_week: Optional[float] = None
    rsi_14: Optional[float] = None

class Fundamentals(BaseModel):
    model_config = ConfigDict(extra="ignore")
    long_name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    price_to_book: Optional[float] = None
    dividend_yield: Optional[float] = None
    beta: Optional[float] = None
    website: Optional[str] = None
    long_business_summary: Optional[str] = None
    currency: Optional[str] = None  # trading currency reported by Yahoo (prices, market cap)
    financial_currency: Optional[str] = None  # currency of the financial statements (earnings, revenue)

class EarningsRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    year: Optional[int] = None
    earnings: Optional[float] = None

class NewsArticle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = ""
    text: str = ""
    url: str = ""
    publish_date: Optional[str] = None

class ResearchReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company: str = ""
    ticker: str = ""
    current_price: Optional[float] = None
    market_cap: Optional[float] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    pe_ratio: Optional[float] = None
    eps: Optional[float] = None
    revenue: Optional[float] = None
    currency: Optional[str] = None  # ISO code of the instrument's prices; None = could not be verified
    currency_source: Optional[str] = None
    generation: Optional[GenerationInfo] = None  # whether the summaries came from the LLM or the fallback
    high_52_week: Optional[float] = None
    low_52_week: Optional[float] = None
    moving_averages: dict = Field(default_factory=dict)
    rsi: Optional[float] = None
    latest_news: list[dict] = Field(default_factory=list)
    fundamental_summary: str = ""
    technical_summary: str = ""
    sentiment: str = ""
    sources: list[str] = Field(default_factory=list)
    market_data_source: Optional[str] = None
    market_data_as_of: Optional[str] = None
    market_data_freshness: Optional[str] = None
    market_data_warnings: list[str] = Field(default_factory=list)

    @computed_field  # derived, so it can never disagree with market_cap / currency
    @property
    def market_cap_tier(self) -> Optional[str]:
        """'mega' | 'large' | 'mid' | 'small', or None = unclassified (see backend/market_cap.py)."""
        return classify_market_cap(self.market_cap, self.currency)

YAHOO_SOURCE = "Yahoo Finance (yfinance)"
NSE_HISTORY_MONTHS = 3  # one tool call (~60 bars): enough for MA50 / RSI14; 52-week range comes from the live NSE quote
DEFAULT_NSE_BUDGET_SECONDS = 8.0  # total wall-clock cap for *optional* NSE enrichment
USABLE_QUOTE_FRESHNESS = {"live", "delayed", "closed"}
CLOSE_COLUMNS = ["Close", "close", "Adj Close", "adj close", "adj_close"]
MIN_BARS_MA20 = 20
MIN_BARS_MA50 = 50
MIN_52W_BARS = 240  # ~95% of the ~252 sessions in a year, tolerating holidays and a few missing bars
MIN_52W_SPAN_DAYS = 350  # the history must actually reach back about a year


@dataclass
class NSEMarketData:
    """What NSE MCP could supply for one symbol. Every field may be absent."""

    quote: Optional[StockQuote] = None
    history: Optional[StockHistory] = None
    warnings: list[str] = field(default_factory=list)


class ResearchAgent:
    def __init__(
        self,
        api_agent: Optional[APIAgent] = None,
        scraping_agent: Optional[ScrapingAgent] = None,
        retriever_agent: Optional[RetrieverAgent] = None,
        language_agent: Optional[LanguageAgent] = None,
        nse_service: Optional[NSEMarketDataService] = None,
        nse_budget_seconds: Optional[float] = None,
    ) -> None:
        self.api_agent = api_agent or APIAgent()
        self.scraping_agent = scraping_agent or ScrapingAgent()
        self.retriever_agent = retriever_agent or RetrieverAgent()
        # the retriever keeps its index on the instance, and requests now run in parallel threads
        self._retrieval_lock = threading.Lock()
        self.language_agent = language_agent or LanguageAgent()
        self._nse_service = nse_service
        if nse_budget_seconds is None:
            try:
                nse_budget_seconds = float(os.getenv("NSE_RESEARCH_BUDGET_SECONDS", DEFAULT_NSE_BUDGET_SECONDS))
            except ValueError:
                nse_budget_seconds = DEFAULT_NSE_BUDGET_SECONDS
        self.nse_budget_seconds = nse_budget_seconds

    def research(self, stock_symbol: str, workflow_state: WorkflowState | None = None) -> ResearchReport:
        symbol = stock_symbol.strip().upper()
        logger.info("Running research pipeline for %s", symbol)

        nse_data = self._fetch_nse_market_data(symbol)
        market_frame, market_source = self._select_market_frame(symbol, nse_data)
        if market_frame is None or market_frame.empty:
            raise ValueError(f"Ticker not found or no market data for '{symbol}'")

        logger.info(f"Retrieved Market Data: Success for {symbol} via {market_source}")

        technical_indicators = self._build_technical_indicators(market_frame)
        market_meta = self._apply_nse_quote(technical_indicators, nse_data, market_source)
        market_meta["warnings"].extend(
            self._indicator_warnings(market_frame, technical_indicators, market_meta["warnings"])
        )
        fundamentals = self._fetch_fundamentals(symbol)
        company_name = fundamentals.long_name or self._company_name_from_symbol(symbol)

        earnings_frame = self.api_agent.get_earnings(symbol)
        earnings_records = self._serialize_earnings(earnings_frame)

        currency, currency_source, currency_warnings = self._resolve_currency(
            market_meta["source"], fundamentals, market_frame
        )
        market_meta["warnings"].extend(w for w in currency_warnings if w not in market_meta["warnings"])

        news_articles = self._fetch_news(symbol)
        context = self._retrieve_context(symbol, company_name, news_articles)

        price = technical_indicators.latest_close
        
        summaries = self.language_agent.generate_research_summaries(
            symbol=symbol,
            company_name=company_name,
            context=context,
            technical_indicators=technical_indicators.model_dump(),
            fundamentals=fundamentals.model_dump(),
            earnings=[e.model_dump() for e in earnings_records],
            currency=currency,
        )

        news_list = [{"title": n.title, "url": n.url, "publish_date": n.publish_date} for n in news_articles]
        sources = list(set([n.url for n in news_articles if n.url]))
        sources.extend(s for s in market_meta["sources"] if s not in sources)

        report = ResearchReport(
            company=company_name,
            ticker=symbol,
            current_price=price,
            market_cap=fundamentals.market_cap,
            sector=fundamentals.sector,
            industry=fundamentals.industry,
            pe_ratio=fundamentals.pe_ratio,
            eps=None, 
            revenue=None,
            currency=currency,
            currency_source=currency_source,
            generation=summaries.get("generation"),
            high_52_week=technical_indicators.high_52_week,
            low_52_week=technical_indicators.low_52_week,
            moving_averages={"20d": technical_indicators.moving_average_20, "50d": technical_indicators.moving_average_50},
            rsi=technical_indicators.rsi_14,
            latest_news=news_list,
            fundamental_summary=summaries.get("fundamental_summary", ""),
            technical_summary=summaries.get("technical_summary", ""),
            sentiment=summaries.get("sentiment", "Neutral"),
            sources=sources,
            market_data_source=market_meta["source"],
            market_data_as_of=market_meta["as_of"],
            market_data_freshness=market_meta["freshness"],
            market_data_warnings=market_meta["warnings"],
        )

        if workflow_state is not None:
            workflow_state.research_report = report
            workflow_state.complete_step(WorkflowStep.RESEARCH)

        return report

    @staticmethod
    def _resolve_currency(market_source: str, fundamentals: Fundamentals, market_frame: pd.DataFrame):
        """Instrument currency from what the data sources report. Nothing is inferred from the ticker
        suffix; NSE cash-market data (the NSE India MCP) is quoted in INR by definition."""
        candidates: list[tuple[str, object]] = []
        if market_source != YAHOO_SOURCE:
            candidates.append((NSE_SOURCE_LABEL, "INR"))
        candidates.append(("Yahoo Finance quote info", getattr(fundamentals, "currency", None)))
        candidates.append(("Yahoo Finance price history", getattr(market_frame, "attrs", {}).get("currency")))
        return resolve_currency(candidates)

    def _fetch_market_frame(self, symbol: str) -> Optional[pd.DataFrame]:
        market_data = self.api_agent.get_market_data([symbol])
        frame = market_data.get(symbol)
        if isinstance(frame, pd.DataFrame) and not frame.empty:
            return frame
        return None

    def _get_nse_service(self) -> Optional[NSEMarketDataService]:
        if self._nse_service is not None:
            return self._nse_service
        if not nse_mcp_enabled():
            return None
        return get_nse_service()

    def _fetch_nse_market_data(self, symbol: str) -> NSEMarketData:
        """Best-effort NSE MCP lookup for '.NS' tickers. Never raises, and never takes longer
        than `nse_budget_seconds` in total: the quote and history requests run concurrently
        against one shared deadline, and whatever has not finished by then is abandoned so the
        Yahoo Finance fallback is not delayed by an NSE outage."""
        data = NSEMarketData()
        service = self._get_nse_service()
        if service is None or not is_nse_symbol(symbol):
            return data

        deadline = time.monotonic() + self.nse_budget_seconds
        pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="nse-research")
        try:
            futures = {
                "live quote": pool.submit(service.get_stock_quote, symbol, deadline=deadline),
                "history": pool.submit(
                    service.get_stock_history, symbol, months=NSE_HISTORY_MONTHS, deadline=deadline
                ),
            }
            # small grace so deadline-aware workers can report their own error before we give up
            wait_futures(list(futures.values()), timeout=self.nse_budget_seconds + 1.0)
            for label, future in futures.items():
                if not future.done():
                    future.cancel()
                    logger.warning("NSE MCP %s for %s abandoned after %.1fs budget", label, symbol, self.nse_budget_seconds)
                    data.warnings.append(f"NSE MCP {label} unavailable: time budget of {self.nse_budget_seconds:.0f}s exceeded")
                    continue
                try:
                    result = future.result()
                except Exception as exc:  # noqa: BLE001 - enrichment must not break research
                    logger.warning("NSE MCP %s unavailable for %s: %s", label, symbol, exc)
                    data.warnings.append(f"NSE MCP {label} unavailable: {exc}")
                    continue
                if label == "live quote":
                    data.quote = result
                else:
                    data.history = result
        finally:
            pool.shutdown(wait=False, cancel_futures=True)
        return data

    def _select_market_frame(self, symbol: str, nse: NSEMarketData) -> tuple[Optional[pd.DataFrame], str]:
        """Use NSE history only when verified free of price-affecting corporate actions
        (NSE prices are unadjusted); otherwise fall back to yfinance, keeping NSE as a last resort."""
        nse_frame = self._frame_from_history(nse.history)
        if nse_frame is not None and nse.history.corporate_actions_checked and not nse.history.price_affecting_actions:
            return nse_frame, "nse"
        if nse.history is not None and nse.history.price_affecting_actions:
            nse.warnings.append("NSE history not used: unadjusted prices span a split/bonus; using Yahoo Finance history")
        elif nse_frame is not None and not nse.history.corporate_actions_checked:
            nse.warnings.append("NSE history not used: corporate-action check unavailable (NSE prices are unadjusted)")
        yahoo_frame = self._fetch_market_frame(symbol)
        if yahoo_frame is not None:
            return yahoo_frame, "yahoo"
        if nse_frame is not None and not nse.history.price_affecting_actions:
            nse.warnings.append("Using NSE history without a completed corporate-action check")
            return nse_frame, "nse"
        return None, "none"

    @staticmethod
    def _frame_from_history(history: Optional[StockHistory]) -> Optional[pd.DataFrame]:
        if history is None or not history.bars:
            return None
        return pd.DataFrame(
            {
                "Date": [b.date for b in history.bars],
                "Open": [b.open for b in history.bars],
                "High": [b.high for b in history.bars],
                "Low": [b.low for b in history.bars],
                "Close": [b.close for b in history.bars],
                "Volume": [b.volume for b in history.bars],
            }
        )

    def _apply_nse_quote(self, indicators: TechnicalIndicators, nse: NSEMarketData, market_source: str) -> dict:
        """Overlay the live NSE quote on the indicators when it is fresh enough, and build
        the attribution/freshness metadata attached to the report."""
        warnings = list(nse.warnings)
        sources: list[str] = []

        def cite(prov) -> None:
            sources.append(f"{prov.source} ({prov.tool}) {prov.endpoint_url}")
            warnings.extend(w for w in prov.warnings if w not in warnings)

        meta: dict = {"source": YAHOO_SOURCE, "as_of": None, "freshness": None}
        used_nse_history = market_source == "nse"
        if used_nse_history:
            prov = nse.history.provenance
            cite(prov)
            meta.update(source=prov.source, as_of=prov.as_of_date, freshness=prov.freshness)
            # a few months of bars must not be presented as a 52-week range
            indicators.high_52_week = indicators.low_52_week = None

        quote = nse.quote
        if quote is not None:
            cite(quote.provenance)
            if quote.provenance.freshness in USABLE_QUOTE_FRESHNESS:
                indicators.latest_close = quote.last_price
                if quote.change_percent is not None:
                    indicators.change_percent = quote.change_percent
                if quote.fifty_two_week_high is not None and quote.fifty_two_week_low is not None:
                    indicators.high_52_week = quote.fifty_two_week_high
                    indicators.low_52_week = quote.fifty_two_week_low
                meta.update(
                    source=quote.provenance.source,
                    as_of=quote.provenance.data_timestamp or quote.provenance.as_of_date,
                    freshness=quote.provenance.freshness,
                )
            else:
                warnings.append(f"NSE live quote ignored: freshness is '{quote.provenance.freshness}'")
        elif used_nse_history:
            warnings.append("52-week range unavailable (NSE live quote missing)")

        meta["warnings"] = warnings
        meta["sources"] = list(dict.fromkeys(sources))
        return meta

    def _fetch_fundamentals(self, symbol: str) -> Fundamentals:
        try:
            import yfinance as yf
        except ModuleNotFoundError:
            yf = None
        if yf is None:
            return Fundamentals(long_name=self._company_name_from_symbol(symbol))
        try:
            info = yf.Ticker(symbol).info or {}
        except Exception as exc:
            info = {}
        return Fundamentals(
            long_name=info.get("longName") or info.get("shortName") or self._company_name_from_symbol(symbol),
            sector=info.get("sector"),
            industry=info.get("industry"),
            market_cap=self._as_float(info.get("marketCap")),
            pe_ratio=self._as_float(info.get("trailingPE") or info.get("forwardPE")),
            price_to_book=self._as_float(info.get("priceToBook")),
            dividend_yield=self._as_float(info.get("dividendYield")),
            beta=self._as_float(info.get("beta")),
            website=info.get("website"),
            long_business_summary=info.get("longBusinessSummary"),
            currency=info.get("currency"),
            financial_currency=info.get("financialCurrency"),
        )

    def _fetch_news(self, symbol: str) -> list[NewsArticle]:
        urls = [f"https://finance.yahoo.com/quote/{symbol}/news/"]
        articles = self.scraping_agent.scrape_news(urls, timeout=15)
        if not articles:
            return []
        normalized_articles: list[NewsArticle] = []
        for article in articles:
            publish_date = article.get("publish_date")
            if isinstance(publish_date, datetime):
                publish_date = publish_date.isoformat()
            normalized_articles.append(
                NewsArticle(
                    title=str(article.get("title", "")),
                    text=str(article.get("text", "")),
                    url=str(article.get("url", "")),
                    publish_date=str(publish_date) if publish_date else None,
                )
            )
        return normalized_articles

    def _retrieve_context(self, symbol: str, company_name: str, articles: list[NewsArticle]) -> list[str]:
        if not articles:
            return []
        documents = [article.model_dump() for article in articles]
        query = f"{company_name} {symbol}"
        with self._retrieval_lock:  # index + retrieve must be atomic, or another request's news leaks into this context
            self.retriever_agent.index_documents(documents)
            context_docs = self.retriever_agent.retrieve(query, k=3)
        context: list[str] = []
        for doc in context_docs:
            if hasattr(doc, "page_content"):
                context.append(str(doc.page_content))
            elif isinstance(doc, dict):
                context.append(str(doc.get("text") or doc.get("content") or doc.get("summary") or doc.get("title") or doc))
            else:
                context.append(str(doc))
        return context

    def _clean_price_frame(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Rows with a valid close only, in chronological order when dates are usable.
        Adds `_close` and (when every date parses) `_date` helper columns."""
        close_col = next((c for c in CLOSE_COLUMNS if c in frame.columns), None)
        if close_col is None:
            return pd.DataFrame({"_close": pd.Series(dtype="float64")})
        work = frame.copy()
        work["_close"] = pd.to_numeric(work[close_col], errors="coerce")
        work = work[work["_close"].notna()]
        if "Date" in work.columns and not work.empty:
            dates = pd.to_datetime(work["Date"], errors="coerce", utc=True)
            if dates.notna().all():
                work = work.assign(_date=dates).sort_values("_date", kind="stable")
                work = work.drop_duplicates("_date", keep="last")
        return work

    def _fifty_two_week_range(self, work: pd.DataFrame) -> tuple[Optional[float], Optional[float]]:
        """High/low over the trailing year, or (None, None) when the history does not
        actually cover about a year (fewer than MIN_52W_BARS bars or too short a date span)."""
        if len(work) < MIN_52W_BARS:
            return None, None
        if "_date" in work.columns:
            last = work["_date"].iloc[-1]
            if work["_date"].iloc[0] > last - pd.Timedelta(days=MIN_52W_SPAN_DAYS):
                return None, None
            window = work[work["_date"] > last - pd.Timedelta(days=365)]
            if len(window) < MIN_52W_BARS:
                return None, None
        else:
            window = work.tail(252)
        highs = pd.to_numeric(window["High"], errors="coerce").dropna() if "High" in window.columns else window["_close"]
        lows = pd.to_numeric(window["Low"], errors="coerce").dropna() if "Low" in window.columns else window["_close"]
        if highs.empty or lows.empty:
            highs = lows = window["_close"]
        return self._series_max(highs), self._series_min(lows)

    def _build_technical_indicators(self, frame: pd.DataFrame) -> TechnicalIndicators:
        work = self._clean_price_frame(frame)
        close_series = work["_close"]
        volume_series = self._numeric_series(work, ["Volume", "volume"])
        latest_close = self._series_last(close_series)
        previous_close = self._series_last(close_series.iloc[:-1]) if len(close_series) > 1 else None
        change_percent = None
        if latest_close is not None and previous_close not in (None, 0):
            change_percent = ((latest_close - previous_close) / previous_close) * 100
        high_52, low_52 = self._fifty_two_week_range(work)
        return TechnicalIndicators(
            latest_close=latest_close,
            change_percent=change_percent,
            # an average over fewer bars than its window is a different indicator: report it as unavailable
            moving_average_20=self._series_mean(close_series.tail(20)) if len(close_series) >= MIN_BARS_MA20 else None,
            moving_average_50=self._series_mean(close_series.tail(50)) if len(close_series) >= MIN_BARS_MA50 else None,
            average_volume_20=self._series_mean(volume_series.tail(20)),
            high_52_week=high_52,
            low_52_week=low_52,
            rsi_14=self._calculate_rsi(close_series, period=14),
        )

    def _indicator_warnings(self, frame: pd.DataFrame, indicators: TechnicalIndicators, existing: list[str]) -> list[str]:
        """Explain every window indicator that could not be computed from the available history."""
        bars = len(self._clean_price_frame(frame))
        warnings: list[str] = []
        if indicators.moving_average_20 is None:
            warnings.append(f"20-day moving average unavailable: only {bars} valid daily closes (need {MIN_BARS_MA20})")
        if indicators.moving_average_50 is None:
            warnings.append(f"50-day moving average unavailable: only {bars} valid daily closes (need {MIN_BARS_MA50})")
        if indicators.high_52_week is None and not any("52-week" in w for w in existing):
            warnings.append(
                f"52-week range unavailable: {bars} valid daily closes in the fetched history "
                f"(need at least {MIN_52W_BARS} spanning {MIN_52W_SPAN_DAYS}+ days)"
            )
        return warnings

    def _serialize_earnings(self, earnings_frame: Any) -> list[EarningsRecord]:
        if not isinstance(earnings_frame, pd.DataFrame) or earnings_frame.empty:
            return []
        records: list[EarningsRecord] = []
        for record in earnings_frame.to_dict(orient="records"):
            records.append(
                EarningsRecord(
                    year=self._as_int(record.get("Year")),
                    earnings=self._as_float(record.get("Earnings")),
                )
            )
        return records

    def _numeric_series(self, frame: pd.DataFrame, candidates: list[str]) -> pd.Series:
        for candidate in candidates:
            if candidate in frame.columns:
                return pd.to_numeric(frame[candidate], errors="coerce").dropna()
        return pd.Series(dtype="float64")

    def _calculate_rsi(self, series: pd.Series, period: int = 14) -> Optional[float]:
        if len(series) < period + 1:
            return None
        delta = series.diff().dropna()
        gain = delta.clip(lower=0).rolling(window=period).mean().iloc[-1]
        loss = (-delta.clip(upper=0)).rolling(window=period).mean().iloc[-1]
        if loss in (None, 0) or pd.isna(loss):
            return 100.0
        rs = gain / loss
        return float(100 - (100 / (1 + rs)))

    def _series_last(self, series: pd.Series) -> Optional[float]:
        if series.empty:
            return None
        value = series.iloc[-1]
        return self._as_float(value)

    def _series_mean(self, series: pd.Series) -> Optional[float]:
        if series.empty:
            return None
        return self._as_float(series.mean())

    def _series_max(self, series: pd.Series) -> Optional[float]:
        if series.empty:
            return None
        return self._as_float(series.max())

    def _series_min(self, series: pd.Series) -> Optional[float]:
        if series.empty:
            return None
        return self._as_float(series.min())

    def _company_name_from_symbol(self, symbol: str) -> str:
        return symbol.split(".")[0].replace("-", " ").title()

    def _as_float(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            if pd.isna(value):
                return None
        except Exception:
            pass
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _as_int(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        try:
            if pd.isna(value):
                return None
        except Exception:
            pass
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
