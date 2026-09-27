from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field

from agents.language_agent import LanguageAgent
from agents.retriever_agent import RetrieverAgent
from data_ingestion.api_agent import APIAgent
from data_ingestion.scrapping_agent import ScrapingAgent
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
    high_52_week: Optional[float] = None
    low_52_week: Optional[float] = None
    moving_averages: dict = Field(default_factory=dict)
    rsi: Optional[float] = None
    latest_news: list[dict] = Field(default_factory=list)
    fundamental_summary: str = ""
    technical_summary: str = ""
    sentiment: str = ""
    sources: list[str] = Field(default_factory=list)

class ResearchAgent:
    def __init__(
        self,
        api_agent: Optional[APIAgent] = None,
        scraping_agent: Optional[ScrapingAgent] = None,
        retriever_agent: Optional[RetrieverAgent] = None,
        language_agent: Optional[LanguageAgent] = None,
    ) -> None:
        self.api_agent = api_agent or APIAgent()
        self.scraping_agent = scraping_agent or ScrapingAgent()
        self.retriever_agent = retriever_agent or RetrieverAgent()
        self.language_agent = language_agent or LanguageAgent()

    def research(self, stock_symbol: str, workflow_state: WorkflowState | None = None) -> ResearchReport:
        symbol = stock_symbol.strip().upper()
        logger.info("Running research pipeline for %s", symbol)

        market_frame = self._fetch_market_frame(symbol)
        if market_frame is None or market_frame.empty:
            raise ValueError(f"Ticker not found or no market data for '{symbol}'")
            
        logger.info(f"Retrieved Market Data: Success for {symbol}")

        technical_indicators = self._build_technical_indicators(market_frame)
        fundamentals = self._fetch_fundamentals(symbol)
        company_name = fundamentals.long_name or self._company_name_from_symbol(symbol)

        earnings_frame = self.api_agent.get_earnings(symbol)
        earnings_records = self._serialize_earnings(earnings_frame)

        news_articles = self._fetch_news(symbol)
        context = self._retrieve_context(symbol, company_name, news_articles)

        price = technical_indicators.latest_close
        
        summaries = self.language_agent.generate_research_summaries(
            symbol=symbol,
            company_name=company_name,
            context=context,
            technical_indicators=technical_indicators.model_dump(),
            fundamentals=fundamentals.model_dump(),
            earnings=[e.model_dump() for e in earnings_records]
        )

        news_list = [{"title": n.title, "url": n.url, "publish_date": n.publish_date} for n in news_articles]
        sources = list(set([n.url for n in news_articles if n.url]))

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
            high_52_week=technical_indicators.high_52_week,
            low_52_week=technical_indicators.low_52_week,
            moving_averages={"20d": technical_indicators.moving_average_20, "50d": technical_indicators.moving_average_50},
            rsi=technical_indicators.rsi_14,
            latest_news=news_list,
            fundamental_summary=summaries.get("fundamental_summary", ""),
            technical_summary=summaries.get("technical_summary", ""),
            sentiment=summaries.get("sentiment", "Neutral"),
            sources=sources
        )

        if workflow_state is not None:
            workflow_state.research_report = report
            workflow_state.complete_step(WorkflowStep.RESEARCH)

        return report

    def _fetch_market_frame(self, symbol: str) -> Optional[pd.DataFrame]:
        market_data = self.api_agent.get_market_data([symbol])
        frame = market_data.get(symbol)
        if isinstance(frame, pd.DataFrame) and not frame.empty:
            return frame
        return None

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
        self.retriever_agent.index_documents(documents)
        query = f"{company_name} {symbol}"
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

    def _build_technical_indicators(self, frame: pd.DataFrame) -> TechnicalIndicators:
        close_series = self._numeric_series(frame, ["Close", "close", "Adj Close", "adj close", "adj_close"])
        volume_series = self._numeric_series(frame, ["Volume", "volume"])
        latest_close = self._series_last(close_series)
        previous_close = self._series_last(close_series.iloc[:-1]) if len(close_series) > 1 else None
        change_percent = None
        if latest_close is not None and previous_close not in (None, 0):
            change_percent = ((latest_close - previous_close) / previous_close) * 100
        return TechnicalIndicators(
            latest_close=latest_close,
            change_percent=change_percent,
            moving_average_20=self._series_mean(close_series.tail(20)),
            moving_average_50=self._series_mean(close_series.tail(50)),
            average_volume_20=self._series_mean(volume_series.tail(20)),
            high_52_week=self._series_max(close_series.tail(252) if len(close_series) > 252 else close_series),
            low_52_week=self._series_min(close_series.tail(252) if len(close_series) > 252 else close_series),
            rsi_14=self._calculate_rsi(close_series, period=14),
        )

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
