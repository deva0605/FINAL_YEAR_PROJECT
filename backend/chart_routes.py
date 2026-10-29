"""Unified OHLCV history endpoint for the interactive stock chart.

Route:  GET /market/history/{symbol}?months=N&source=auto

Tries NSE MCP first for .NS tickers (up to 12 months per NSE tool limits),
then falls back to Yahoo Finance (yfinance) which supports multi-year lookups.
The response shape is identical regardless of the source so the chart component
does not need to know which provider answered.

Notes
-----
- NSE prices are end-of-day and unadjusted.  Yahoo Finance prices are adjusted.
  Both are labelled correctly in the response.
- Credentials are never exposed to the caller.
- CORS is handled by the main FastAPI app.
"""
from __future__ import annotations

import logging
import math
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["chart-data"])

# ---------------------------------------------------------------------- models


class OhlcBar(BaseModel):
    """A single daily OHLCV bar in YYYY-MM-DD format."""

    date: str  # ISO 8601 date, e.g. "2024-12-31"
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    volume: Optional[int] = None


class ChartHistoryResponse(BaseModel):
    symbol: str
    exchange: Optional[str] = None          # "NSE" | "Yahoo Finance" | None
    source: str                              # human-readable provider label
    price_adjusted: bool                     # True = split/dividend adjusted (Yahoo), False = raw (NSE)
    currency: Optional[str] = None           # ISO 4217 or None when unknown
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    bars: list[OhlcBar]
    warnings: list[str]


# ---------------------------------------------------------------------- helpers

def _num(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def _pos(v: Any) -> Optional[float]:
    f = _num(v)
    return f if f is not None and f > 0 else None


def _int(v: Any) -> Optional[int]:
    f = _num(v)
    return int(f) if f is not None and f >= 0 else None


# ---------------------------------------------------------------------- NSE fetch

def _fetch_nse(symbol: str, months: int) -> Optional[ChartHistoryResponse]:
    """Attempt to get OHLCV from NSE MCP.  Returns None when NSE is unavailable or
    the symbol is not an NSE ticker."""
    try:
        from data_ingestion.nse_mcp_client import NSEMCPDisabledError, nse_mcp_enabled
        from data_ingestion.nse_market_service import (
            NSEMCPDataError,
            NSESymbolError,
            get_nse_service,
            normalize_symbol,
        )
    except ImportError:
        return None

    # Only try NSE for .NS tickers
    raw = symbol.strip().upper()
    if not raw.endswith(".NS") and not _could_be_nse_plain(raw):
        return None

    try:
        if not nse_mcp_enabled():
            return None
        nse_sym = normalize_symbol(raw)
        svc = get_nse_service()
        # Cap NSE attempt at 6 s so we don't block the Yahoo fallback unnecessarily
        clamped = min(months, 12)
        deadline = time.monotonic() + 6.0
        history = svc.get_stock_history(nse_sym, months=clamped, check_corporate_actions=True, deadline=deadline)
    except (NSESymbolError, NSEMCPDataError, NSEMCPDisabledError, Exception) as exc:
        logger.info("NSE chart history unavailable for %s: %s", symbol, exc)
        return None

    warnings = list(history.provenance.warnings)
    bars: list[OhlcBar] = []
    for b in history.bars:
        bars.append(OhlcBar(
            date=b.date,
            open=b.open,
            high=b.high,
            low=b.low,
            close=b.close,
            volume=b.volume,
        ))

    return ChartHistoryResponse(
        symbol=nse_sym,
        exchange="NSE",
        source="NSE India (Bhavcopy/MCP) — end-of-day, unadjusted",
        price_adjusted=False,
        currency="INR",
        from_date=history.from_date,
        to_date=history.to_date,
        bars=bars,
        warnings=warnings,
    )


def _could_be_nse_plain(sym: str) -> bool:
    """Heuristic: a bare symbol like 'RELIANCE' (no suffix) might be NSE."""
    return bool(sym) and "." not in sym and sym.isalnum()


# ---------------------------------------------------------------------- Yahoo fetch

def _fetch_yahoo(symbol: str, months: int) -> ChartHistoryResponse:
    """Fetch OHLCV from yfinance.  Raises HTTPException on hard failure."""
    try:
        import yfinance as yf
    except ImportError:
        raise HTTPException(status_code=503, detail="yfinance is not installed on the server")

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=int(months * 31))

    warnings: list[str] = []
    try:
        ticker_obj = yf.Ticker(symbol)
        hist = ticker_obj.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), auto_adjust=True)
        meta = ticker_obj.history_metadata or {}
        currency = meta.get("currency")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Yahoo Finance unavailable: {exc}") from exc

    if hist is None or hist.empty:
        raise HTTPException(status_code=404, detail=f"No price history from Yahoo Finance for '{symbol}'")

    hist = hist.reset_index()

    bars: list[OhlcBar] = []
    for _, row in hist.iterrows():
        raw_date = row.get("Date")
        close = _pos(row.get("Close"))
        if close is None:
            continue
        try:
            date_str = str(raw_date)[:10]  # "YYYY-MM-DD" or datetime truncate
        except Exception:
            continue
        high = _pos(row.get("High"))
        low = _pos(row.get("Low"))
        if high is not None and low is not None and high < low:
            high = low = None
        bars.append(OhlcBar(
            date=date_str,
            open=_pos(row.get("Open")),
            high=high,
            low=low,
            close=close,
            volume=_int(row.get("Volume")),
        ))

    if not bars:
        raise HTTPException(status_code=404, detail=f"No valid OHLCV bars from Yahoo Finance for '{symbol}'")

    # Sort chronologically and deduplicate
    bars.sort(key=lambda b: b.date)
    seen: dict[str, OhlcBar] = {}
    for b in bars:
        seen[b.date] = b
    bars = list(seen.values())

    if months > 12:
        warnings.append(
            "Prices are split and dividend adjusted (Yahoo Finance auto_adjust=True)."
        )
    else:
        warnings.append("Prices are adjusted for splits and dividends (Yahoo Finance).")

    exchange = None
    sym_upper = symbol.upper()
    if sym_upper.endswith(".NS"):
        exchange = "NSE"
    elif sym_upper.endswith(".BO"):
        exchange = "BSE"

    return ChartHistoryResponse(
        symbol=symbol,
        exchange=exchange,
        source="Yahoo Finance (yfinance) — split/dividend adjusted",
        price_adjusted=True,
        currency=currency,
        from_date=bars[0].date if bars else None,
        to_date=bars[-1].date if bars else None,
        bars=bars,
        warnings=warnings,
    )


# ---------------------------------------------------------------------- route

@router.get("/history/{symbol}", response_model=ChartHistoryResponse)
def chart_history(
    symbol: str,
    months: int = Query(3, ge=1, le=60, description="Number of calendar months of history (1–60)"),
) -> ChartHistoryResponse:
    """Daily OHLCV history for interactive charting.

    Tries NSE MCP first for NSE symbols (up to 12 months), then falls back to
    Yahoo Finance which supports up to 60 months. The 'source' and
    'price_adjusted' fields in the response identify the provider and whether
    the prices are raw or adjusted.
    """
    sym = (symbol or "").strip()
    if not sym:
        raise HTTPException(status_code=422, detail="symbol must not be empty")

    # Try NSE first for NSE tickers when requesting ≤ 12 months
    if months <= 12:
        nse_result = _fetch_nse(sym, months)
        if nse_result is not None and nse_result.bars:
            return nse_result

    # Fall back to Yahoo Finance
    return _fetch_yahoo(sym, months)
