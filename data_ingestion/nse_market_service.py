"""Market-data service on top of NSE's MCP servers.

Only tools that were discovered on the live servers are used:

  CM Market Live (cmmkt)            Bhavcopy (bhavcopy/cm)
  - cm_get_stock_quote              - get_stock_history      (daily OHLCV, EOD, unadjusted)
  - cm_get_index_quote              - get_index_history      (daily index OHLC, EOD)
  - cm_get_live_indices             - get_corporate_actions  (to detect price-affecting events)
                                    - search_symbols

Every result carries a `DataProvenance` block: source, tool, retrieval time, the data's own
timestamp, a freshness label and any validation warnings. Nothing is ever defaulted or
fabricated: missing/invalid upstream values become None plus a warning.

NSE data is offered for informational/educational use. Do not assume redistribution,
commercial use or AI-training rights - see docs/nse_mcp_integration.md.
"""
from __future__ import annotations

import copy
import logging
import math
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Literal, Optional

from pydantic import BaseModel, Field

from data_ingestion.nse_mcp_client import (
    BHAVCOPY_ENDPOINT,
    CM_MARKET_ENDPOINT,
    NSEMCPClient,
    NSEMCPError,
)

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))  # India has no DST
SESSION_OPEN = (9, 15)
SESSION_CLOSE = (15, 30)

SOURCE_NAME = "NSE India MCP"
DISCLAIMER = (
    "Source: NSE India (NSEIL) MCP server. For informational and educational purposes only; "
    "not investment advice. Redistribution, commercial use and AI-model training are not assumed "
    "to be permitted - check NSE's terms before any such use."
)

Freshness = Literal["live", "delayed", "closed", "eod", "stale", "unknown"]

LIVE_MAX_AGE = timedelta(minutes=6)  # CM feed refreshes ~1 min (indices/prices); allow slack
DELAYED_MAX_AGE = timedelta(minutes=30)
AFTER_HOURS_MAX_AGE = timedelta(days=4)  # weekend + one holiday
EOD_STALE_AFTER_DAYS = 4

QUOTE_TTL = 30.0
HISTORY_TTL = 15 * 60.0
TOOLS_TTL = 60 * 60.0

_SYMBOL_RE = re.compile(r"^[A-Z0-9][A-Z0-9&\-]{0,24}$")


class NSEMCPDataError(NSEMCPError):
    """Upstream answered, but the payload is unusable (missing or invalid core fields)."""


class NSESymbolError(ValueError):
    """The symbol is malformed or not an NSE symbol."""


# --------------------------------------------------------------------------- models
class DataProvenance(BaseModel):
    source: str = SOURCE_NAME
    endpoint_url: str
    tool: str
    retrieved_at: str
    data_timestamp: Optional[str] = None  # the data's own timestamp, ISO-8601 with offset
    as_of_date: Optional[str] = None  # YYYY-MM-DD of the most recent datum
    freshness: Freshness = "unknown"
    warnings: list[str] = Field(default_factory=list)
    disclaimer: str = DISCLAIMER


class StockQuote(BaseModel):
    symbol: str
    series: Optional[str] = None
    last_price: float
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    previous_close: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    volume: Optional[int] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    change_30d_percent: Optional[float] = None
    provenance: DataProvenance


class IndexQuote(BaseModel):
    index_name: str
    last: float
    previous_close: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    year_high: Optional[float] = None
    year_low: Optional[float] = None
    comparisons: dict[str, Any] = Field(default_factory=dict)
    provenance: DataProvenance


class IndexList(BaseModel):
    returned: int
    indices: dict[str, list[dict[str, Any]]]
    provenance: DataProvenance


class PriceBar(BaseModel):
    date: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    volume: Optional[int] = None


class CorporateAction(BaseModel):
    ex_date: Optional[str] = None
    action_type: Optional[str] = None
    purpose: Optional[str] = None
    adjustment_factor: Optional[float] = None


class StockHistory(BaseModel):
    symbol: str
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    bars: list[PriceBar]
    price_adjusted: bool = False  # NSE bhavcopy prices are raw, not split/bonus adjusted
    price_affecting_actions: list[CorporateAction] = Field(default_factory=list)
    corporate_actions_checked: bool = False
    provenance: DataProvenance


class IndexHistory(BaseModel):
    index_name: str
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    bars: list[PriceBar]
    provenance: DataProvenance


# --------------------------------------------------------------------------- helpers
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_symbol(symbol: str) -> str:
    """'reliance.ns' -> 'RELIANCE'. BSE (.BO) and malformed symbols are rejected."""
    cleaned = (symbol or "").strip().upper()
    if cleaned.endswith(".BO"):
        raise NSESymbolError(f"'{symbol}' is a BSE symbol; NSE MCP only serves NSE symbols")
    if cleaned.endswith(".NS"):
        cleaned = cleaned[:-3]
    if not _SYMBOL_RE.match(cleaned):
        raise NSESymbolError(f"'{symbol}' is not a valid NSE symbol")
    return cleaned


def is_nse_symbol(symbol: str) -> bool:
    """True for yfinance-style NSE tickers ('RELIANCE.NS')."""
    return (symbol or "").strip().upper().endswith(".NS")


def _num(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _positive(value: Any) -> Optional[float]:
    number = _num(value)
    return number if number is not None and number > 0 else None


def _int(value: Any) -> Optional[int]:
    number = _num(value)
    return int(number) if number is not None and number >= 0 else None


def _parse_ist(text: Any, fmt: str) -> Optional[datetime]:
    try:
        return datetime.strptime(str(text), fmt).replace(tzinfo=IST)
    except (TypeError, ValueError):
        return None


def _parse_utc(text: Any) -> Optional[datetime]:
    try:
        raw = str(text).replace("Z", "+00:00")
        # NSE sends nanosecond precision; datetime accepts at most microseconds
        raw = re.sub(r"(\.\d{6})\d+", r"\1", raw)
        parsed = datetime.fromisoformat(raw)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def in_trading_session(moment: datetime) -> bool:
    """Mon-Fri 09:15-15:30 IST. Exchange holidays are not known to this check."""
    local = moment.astimezone(IST)
    if local.weekday() >= 5:
        return False
    minutes = local.hour * 60 + local.minute
    return SESSION_OPEN[0] * 60 + SESSION_OPEN[1] <= minutes <= SESSION_CLOSE[0] * 60 + SESSION_CLOSE[1]


def assess_live_freshness(data_ts: Optional[datetime], now: datetime) -> tuple[Freshness, list[str]]:
    if data_ts is None:
        return "unknown", ["NSE returned no usable data timestamp; freshness cannot be verified"]
    age = now - data_ts
    if age < -timedelta(minutes=2):
        return "unknown", [f"Data timestamp {data_ts.isoformat()} is in the future; clock skew or bad data"]
    if in_trading_session(now):
        if age <= LIVE_MAX_AGE:
            return "live", []
        if age <= DELAYED_MAX_AGE:
            return "delayed", [f"Data is {int(age.total_seconds() // 60)} min old during market hours"]
        return "stale", [f"Data is {int(age.total_seconds() // 60)} min old during market hours; feed may be stalled"]
    if age <= AFTER_HOURS_MAX_AGE:
        return "closed", ["Market is closed; showing the most recent session's data"]
    return "stale", [f"Data is {age.days} days old"]


def _previous_weekday(day: date) -> date:
    day -= timedelta(days=1)
    while day.weekday() >= 5:
        day -= timedelta(days=1)
    return day


def assess_eod_freshness(as_of: Optional[date], now: datetime) -> tuple[Freshness, list[str]]:
    if as_of is None:
        return "unknown", ["No as-of date in NSE response"]
    today = now.astimezone(IST).date()
    if as_of > today:
        return "unknown", [f"as-of date {as_of} is in the future"]
    if (today - as_of).days > EOD_STALE_AFTER_DAYS:
        return "stale", [f"Latest end-of-day data is from {as_of} ({(today - as_of).days} days ago)"]
    if as_of < _previous_weekday(today):
        return "eod", [f"End-of-day data ({as_of}) lags the last expected session; possible holiday or late publish"]
    return "eod", []


class _TTLCache:
    def __init__(self) -> None:
        self._items: dict[Any, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: Any) -> Any:
        with self._lock:
            item = self._items.get(key)
            if item and item[0] > time.monotonic():
                return copy.deepcopy(item[1])
            self._items.pop(key, None)
            return None

    def put(self, key: Any, value: Any, ttl: float) -> None:
        with self._lock:
            self._items[key] = (time.monotonic() + ttl, copy.deepcopy(value))


# --------------------------------------------------------------------------- service
class NSEMarketDataService:
    def __init__(self, client: Optional[NSEMCPClient] = None, clock: Callable[[], datetime] = now_utc) -> None:
        self.client = client or NSEMCPClient()
        self._clock = clock
        self._cache = _TTLCache()
        self._pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="nse-svc")

    # ---- provenance
    def _provenance(self, endpoint: str, tool: str, **kwargs: Any) -> DataProvenance:
        return DataProvenance(
            endpoint_url=self.client.endpoint_urls[endpoint],
            tool=tool,
            retrieved_at=self._clock().isoformat(),
            **kwargs,
        )

    def _cached(self, key: Any, ttl: float, producer: Callable[[], Any]) -> Any:
        hit = self._cache.get(key)
        if hit is not None:
            return hit
        value = producer()
        self._cache.put(key, value, ttl)
        return value

    # ---- live quotes
    def get_stock_quote(self, symbol: str, deadline: Optional[float] = None) -> StockQuote:
        """`deadline` is an optional absolute time.monotonic() cut-off for the upstream call."""
        nse_symbol = normalize_symbol(symbol)
        return self._cached(("quote", nse_symbol), QUOTE_TTL, lambda: self._fetch_stock_quote(nse_symbol, deadline))

    def _fetch_stock_quote(self, symbol: str, deadline: Optional[float] = None) -> StockQuote:
        tool = "cm_get_stock_quote"
        payload = self.client.call_tool(CM_MARKET_ENDPOINT, tool, {"symbol": symbol}, deadline=deadline)
        stock = payload.get("stock") if isinstance(payload, dict) else None
        if not isinstance(stock, dict):
            raise NSEMCPDataError(f"{tool} returned no 'stock' object for {symbol}")

        warnings: list[str] = []
        last = _positive(stock.get("lastTradedPrice"))
        if last is None:
            raise NSEMCPDataError(f"{tool} returned no valid last traded price for {symbol}")
        if str(stock.get("symbol", symbol)).upper() != symbol:
            raise NSEMCPDataError(f"{tool} returned data for '{stock.get('symbol')}', expected '{symbol}'")

        open_, high, low = _positive(stock.get("openPrice")), _positive(stock.get("highPrice")), _positive(stock.get("lowPrice"))
        if high is not None and low is not None and high < low:
            warnings.append(f"Day high ({high}) is below day low ({low}); range discarded")
            high = low = None
        elif high is not None and low is not None and not (low * 0.999 <= last <= high * 1.001):
            warnings.append(f"Last price {last} lies outside the day range {low}-{high}")
        prev = _positive(stock.get("preClosePrice"))
        w52_high, w52_low = _positive(stock.get("fiftyTwoWeekHigh")), _positive(stock.get("fiftyTwoWeekLow"))
        if w52_high is None or w52_low is None:
            warnings.append("52-week high/low missing in NSE response")
        elif w52_high < w52_low:
            warnings.append("52-week high is below 52-week low; values discarded")
            w52_high = w52_low = None
        if prev is None:
            warnings.append("Previous close missing in NSE response")

        data_ts = _parse_ist(stock.get("latestTimestamp"), "%Y-%m-%d %H:%M:%S")
        freshness, fresh_warnings = assess_live_freshness(data_ts, self._clock())
        warnings.extend(fresh_warnings)
        updated = _parse_utc(payload.get("updatedAt"))
        if updated is not None and data_ts is not None and updated - data_ts > timedelta(minutes=10) and freshness == "live":
            warnings.append("NSE cache refresh time is well ahead of the trade timestamp")

        return StockQuote(
            symbol=symbol,
            series=stock.get("series"),
            last_price=last,
            open=open_,
            high=high,
            low=low,
            previous_close=prev,
            change=_num(stock.get("change")),
            change_percent=_num(stock.get("perChange")),
            volume=_int(stock.get("volume")),
            fifty_two_week_high=w52_high,
            fifty_two_week_low=w52_low,
            change_30d_percent=_num(stock.get("perChange30d")),
            provenance=self._provenance(
                CM_MARKET_ENDPOINT,
                tool,
                data_timestamp=data_ts.isoformat() if data_ts else None,
                as_of_date=data_ts.date().isoformat() if data_ts else None,
                freshness=freshness,
                warnings=warnings,
            ),
        )

    def get_index_quote(self, index_name: str) -> IndexQuote:
        name = (index_name or "").strip()
        if not name or len(name) > 60:
            raise NSESymbolError("index name is empty or too long")
        return self._cached(("index", name.upper()), QUOTE_TTL, lambda: self._fetch_index_quote(name))

    def _fetch_index_quote(self, name: str) -> IndexQuote:
        tool = "cm_get_index_quote"
        payload = self.client.call_tool(CM_MARKET_ENDPOINT, tool, {"indexName": name})
        index = payload.get("index") if isinstance(payload, dict) else None
        if not isinstance(index, dict):
            raise NSEMCPDataError(f"{tool} returned no 'index' object for '{name}'")
        last = _positive(index.get("last"))
        if last is None:
            raise NSEMCPDataError(f"{tool} returned no valid index value for '{name}'")

        warnings: list[str] = []
        data_ts = _parse_ist(payload.get("nseTimestamp"), "%d-%b-%Y %H:%M:%S") or _parse_ist(
            index.get("timeVal"), "%d-%b-%Y %H:%M"
        )
        freshness, fresh_warnings = assess_live_freshness(data_ts, self._clock())
        warnings.extend(fresh_warnings)
        if _positive(index.get("previousClose")) is None:
            warnings.append("Previous close missing in NSE response")
        comparisons = index.get("comparisons") if isinstance(index.get("comparisons"), dict) else {}

        return IndexQuote(
            index_name=str(index.get("indexName") or name),
            last=last,
            previous_close=_positive(index.get("previousClose")),
            change=_num(index.get("change")),
            change_percent=_num(index.get("percChange")),
            open=_positive(index.get("open")),
            high=_positive(index.get("high")),
            low=_positive(index.get("low")),
            year_high=_positive(index.get("yearHigh")),
            year_low=_positive(index.get("yearLow")),
            comparisons=comparisons,
            provenance=self._provenance(
                CM_MARKET_ENDPOINT,
                tool,
                data_timestamp=data_ts.isoformat() if data_ts else None,
                as_of_date=data_ts.date().isoformat() if data_ts else None,
                freshness=freshness,
                warnings=warnings,
            ),
        )

    def list_indices(self, group: str = "", name_filter: str = "") -> IndexList:
        group, name_filter = (group or "").strip().lower(), (name_filter or "").strip()
        allowed = {"", "all", "derivatives", "broad", "sectoral", "strategy", "thematic", "fixed_income"}
        if group not in allowed:
            raise NSESymbolError(f"unknown index group '{group}'; expected one of {sorted(a for a in allowed if a)}")
        key = ("indices", group, name_filter.upper())
        return self._cached(key, QUOTE_TTL, lambda: self._fetch_indices(group, name_filter))

    def _fetch_indices(self, group: str, name_filter: str) -> IndexList:
        tool = "cm_get_live_indices"
        payload = self.client.call_tool(CM_MARKET_ENDPOINT, tool, {"group": group, "nameFilter": name_filter})
        indices = payload.get("indices") if isinstance(payload, dict) else None
        if not isinstance(indices, dict):
            raise NSEMCPDataError(f"{tool} returned no 'indices' object")
        data_ts = _parse_ist(payload.get("nseTimestamp"), "%d-%b-%Y %H:%M:%S")
        freshness, warnings = assess_live_freshness(data_ts, self._clock())
        return IndexList(
            returned=int(_num(payload.get("returned")) or sum(len(v) for v in indices.values())),
            indices=indices,
            provenance=self._provenance(
                CM_MARKET_ENDPOINT,
                tool,
                data_timestamp=data_ts.isoformat() if data_ts else None,
                as_of_date=data_ts.date().isoformat() if data_ts else None,
                freshness=freshness,
                warnings=warnings,
            ),
        )

    # ---- history
    def get_stock_history(
        self, symbol: str, months: int = 3, check_corporate_actions: bool = True, deadline: Optional[float] = None
    ) -> StockHistory:
        nse_symbol = normalize_symbol(symbol)
        months = self._clamp_months(months, 12)
        key = ("history", nse_symbol, months, check_corporate_actions)
        hit = self._cache.get(key)
        if hit is not None:
            return hit
        history = self._fetch_stock_history(nse_symbol, months, check_corporate_actions, deadline)
        # An unverified result (corporate-action lookup failed) must not stay cached: retry next call
        if history.corporate_actions_checked or not check_corporate_actions:
            self._cache.put(key, history, HISTORY_TTL)
        return history

    @staticmethod
    def _clamp_months(months: int, maximum: int) -> int:
        try:
            months = int(months)
        except (TypeError, ValueError):
            raise NSESymbolError("months must be an integer")
        if months < 1 or months > maximum:
            raise NSESymbolError(f"months must be between 1 and {maximum}")
        return months

    def _chain_history(
        self, tool: str, base_args: dict[str, Any], months: int, chunk_max: int, deadline: Optional[float] = None
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """Chain calls through `next_end_date` (documented in the tool descriptions)."""
        rows: dict[str, dict[str, Any]] = {}
        remaining, end_date, first_page = months, "today", None
        while remaining > 0:
            chunk = min(remaining, chunk_max)
            page = self.client.call_tool(
                BHAVCOPY_ENDPOINT, tool, {**base_args, "months": chunk, "endDate": end_date}, deadline=deadline
            )
            if not isinstance(page, dict) or not isinstance(page.get("data"), list):
                raise NSEMCPDataError(f"{tool} returned no 'data' list")
            first_page = first_page or page
            for row in page["data"]:
                if isinstance(row, dict) and row.get("date"):
                    rows[str(row["date"])] = row
            remaining -= chunk
            end_date = page.get("next_end_date")
            if remaining > 0 and not end_date:
                break
        return [rows[d] for d in sorted(rows)], first_page or {}

    def _validate_bars(self, rows: list[dict[str, Any]], warnings: list[str]) -> list[PriceBar]:
        bars: list[PriceBar] = []
        dropped = 0
        for row in rows:
            try:
                day = datetime.strptime(str(row.get("date")), "%Y-%m-%d").date()
            except ValueError:
                dropped += 1
                continue
            close = _positive(row.get("close"))
            if close is None:
                dropped += 1
                continue
            high, low = _positive(row.get("high")), _positive(row.get("low"))
            if high is not None and low is not None and high < low:
                high = low = None
            bars.append(
                PriceBar(
                    date=day.isoformat(),
                    open=_positive(row.get("open")),
                    high=high,
                    low=low,
                    close=close,
                    volume=_int(row.get("volume")),
                )
            )
        if dropped:
            warnings.append(f"Dropped {dropped} row(s) with missing/invalid date or close price")
        if any(b.volume is None for b in bars):
            warnings.append("Some rows have missing volume")
        return bars

    def _fetch_stock_history(
        self, symbol: str, months: int, check_actions: bool, deadline: Optional[float] = None
    ) -> StockHistory:
        tool = "get_stock_history"
        # The corporate-action lookup does not depend on the price rows, so run it concurrently
        # over a window that is at least as wide as the requested history.
        window_to = self._clock().astimezone(IST).date()
        window_from = window_to - timedelta(days=months * 31 + 7)
        actions_future = (
            self._pool.submit(self._price_affecting_actions, symbol, window_from.isoformat(), window_to.isoformat(), deadline)
            if check_actions
            else None
        )
        rows, first_page = self._chain_history(tool, {"symbol": symbol}, months, chunk_max=3, deadline=deadline)
        warnings: list[str] = []
        bars = self._validate_bars(rows, warnings)
        if not bars:
            raise NSEMCPDataError(f"{tool} returned no usable price rows for {symbol}")
        as_of = datetime.strptime(bars[-1].date, "%Y-%m-%d").date()
        freshness, fresh_warnings = assess_eod_freshness(as_of, self._clock())
        warnings.extend(fresh_warnings)

        actions: list[CorporateAction] = []
        checked = False
        if actions_future is not None:
            try:
                wait = None if deadline is None else max(0.1, deadline - time.monotonic()) + 2
                actions = actions_future.result(timeout=wait)
                if bars[0].date < window_from.isoformat():
                    # returned bars start before the window that was checked: not fully covered
                    actions, checked = [], False
                    warnings.append(
                        "Corporate-action check unavailable (history extends beyond the checked window); "
                        "prices are unadjusted and may be distorted by splits/bonuses"
                    )
                else:
                    checked = True
            except (NSEMCPError, TimeoutError) as exc:
                warnings.append(f"Corporate-action check unavailable ({exc}); prices are unadjusted and may be distorted by splits/bonuses")
        if actions:
            warnings.append(
                "Price-affecting corporate action(s) inside this window; NSE prices are NOT adjusted, "
                "so returns/moving averages across the ex-date are unreliable: "
                + "; ".join(f"{a.ex_date} {a.purpose}" for a in actions)
            )
        else:
            warnings.append("Prices are raw (not adjusted for splits/bonuses)")

        return StockHistory(
            symbol=symbol,
            from_date=bars[0].date,
            to_date=bars[-1].date,
            bars=bars,
            price_adjusted=False,
            price_affecting_actions=actions,
            corporate_actions_checked=checked,
            provenance=self._provenance(
                BHAVCOPY_ENDPOINT,
                tool,
                data_timestamp=None,
                as_of_date=as_of.isoformat(),
                freshness=freshness,
                warnings=warnings,
            ),
        )

    def _price_affecting_actions(
        self, symbol: str, from_date: str, to_date: str, deadline: Optional[float] = None
    ) -> list[CorporateAction]:
        payload = self.client.call_tool(
            BHAVCOPY_ENDPOINT,
            "get_corporate_actions",
            {"symbol": symbol, "fromDate": from_date, "toDate": to_date},
            deadline=deadline,
        )
        if not isinstance(payload, dict) or not isinstance(payload.get("actions"), list):
            raise NSEMCPDataError("get_corporate_actions returned no 'actions' list")
        if payload.get("warning"):
            raise NSEMCPDataError(f"corporate-action list incomplete: {payload['warning']}")
        found = []
        for raw in payload["actions"]:
            if not isinstance(raw, dict):
                continue
            factor = _num(raw.get("adjustmentFactor"))
            kind = str(raw.get("actionType") or "").upper()
            if (factor is not None and abs(factor - 1.0) > 1e-9) or kind in {"SPLIT", "BONUS"}:
                found.append(
                    CorporateAction(
                        ex_date=raw.get("exDate"),
                        action_type=raw.get("actionType"),
                        purpose=raw.get("purpose"),
                        adjustment_factor=factor,
                    )
                )
        return found

    def get_index_history(self, index_name: str, months: int = 3) -> IndexHistory:
        name = (index_name or "").strip()
        if not name or len(name) > 60:
            raise NSESymbolError("index name is empty or too long")
        months = self._clamp_months(months, 24)
        return self._cached(("index_history", name.upper(), months), HISTORY_TTL, lambda: self._fetch_index_history(name, months))

    def _fetch_index_history(self, name: str, months: int) -> IndexHistory:
        tool = "get_index_history"
        rows, first_page = self._chain_history(tool, {"indexName": name}, months, chunk_max=12)
        warnings: list[str] = []
        bars = self._validate_bars(rows, warnings)
        if not bars:
            raise NSEMCPDataError(f"{tool} returned no usable rows for '{name}'")
        as_of = datetime.strptime(bars[-1].date, "%Y-%m-%d").date()
        freshness, fresh_warnings = assess_eod_freshness(as_of, self._clock())
        warnings.extend(fresh_warnings)
        return IndexHistory(
            index_name=str(first_page.get("index") or name),
            from_date=bars[0].date,
            to_date=bars[-1].date,
            bars=bars,
            provenance=self._provenance(
                BHAVCOPY_ENDPOINT, tool, as_of_date=as_of.isoformat(), freshness=freshness, warnings=warnings
            ),
        )

    # ---- discovery
    def search_symbols(self, query: str) -> dict[str, Any]:
        query = (query or "").strip()
        if len(query) < 2 or len(query) > 40:
            raise NSESymbolError("query must be 2-40 characters")
        tool = "search_symbols"
        payload = self.client.call_tool(BHAVCOPY_ENDPOINT, tool, {"query": query})
        matches = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(matches, list):
            raise NSEMCPDataError(f"{tool} returned no 'results' list")
        return {
            "query": query,
            "results": matches,
            "provenance": self._provenance(BHAVCOPY_ENDPOINT, tool).model_dump(),
        }

    def list_tools(self) -> dict[str, list[dict[str, Any]]]:
        """Live tool catalogue of both servers; an unreachable server is reported, not hidden."""

        def produce() -> dict[str, Any]:
            out: dict[str, Any] = {}
            for endpoint in (CM_MARKET_ENDPOINT, BHAVCOPY_ENDPOINT):
                try:
                    out[endpoint] = {"url": self.client.endpoint_urls[endpoint], "tools": self.client.list_tools(endpoint)}
                except NSEMCPError as exc:
                    out[endpoint] = {"url": self.client.endpoint_urls[endpoint], "tools": [], "error": str(exc)}
            return out

        result = self._cache.get(("tools",))
        if result is not None:
            return result
        result = produce()
        if all("error" not in v for v in result.values()):  # never cache a partial outage
            self._cache.put(("tools",), result, TOOLS_TTL)
        return result


_default_service: Optional[NSEMarketDataService] = None
_default_lock = threading.Lock()


def get_nse_service() -> NSEMarketDataService:
    """Process-wide service so cache, cooldown and concurrency limits are shared."""
    global _default_service
    with _default_lock:
        if _default_service is None:
            _default_service = NSEMarketDataService()
        return _default_service
