"""FastAPI routes exposing NSE MCP market data to the frontend.

The browser never talks to NSE: it calls these routes and the backend talks to NSE's MCP
servers. Handlers are plain `def` so FastAPI runs them in its thread pool (the MCP client
is blocking-safe and thread-safe).
"""
from __future__ import annotations

import logging
from typing import NoReturn, Optional

from fastapi import APIRouter, HTTPException, Query

from data_ingestion.nse_market_service import (
    NSEMCPDataError,
    NSESymbolError,
    get_nse_service,
)
from data_ingestion.nse_mcp_client import (
    NSEMCPDisabledError,
    NSEMCPError,
    NSEMCPTimeoutError,
    NSEMCPToolError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market/nse", tags=["nse-market-data"])


def _raise_http(exc: Exception) -> NoReturn:
    """Translate service errors into HTTP errors without leaking internals."""
    if isinstance(exc, NSESymbolError):
        raise HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, NSEMCPToolError):
        if "not found" in str(exc).lower():
            raise HTTPException(status_code=404, detail=str(exc))
        raise HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, NSEMCPDisabledError):
        raise HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, NSEMCPTimeoutError):
        raise HTTPException(status_code=504, detail=f"NSE MCP timed out: {exc}")
    if isinstance(exc, NSEMCPDataError):
        raise HTTPException(status_code=502, detail=f"NSE returned unusable data: {exc}")
    if isinstance(exc, NSEMCPError):
        raise HTTPException(status_code=502, detail=f"NSE MCP unavailable: {exc}")
    logger.exception("Unexpected NSE route failure")
    raise HTTPException(status_code=500, detail="Internal error while fetching NSE data")


@router.get("/tools")
def list_tools():
    """Live tool catalogue (names, descriptions, input schemas) from both NSE servers."""
    try:
        return get_nse_service().list_tools()
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)


@router.get("/quote/{symbol}")
def stock_quote(symbol: str):
    """Live quote (CM Market Live: cm_get_stock_quote)."""
    try:
        return get_nse_service().get_stock_quote(symbol)
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)


@router.get("/indices")
def live_indices(group: str = "", name: str = ""):
    """Live index values, optionally by group/name filter (cm_get_live_indices)."""
    try:
        return get_nse_service().list_indices(group=group, name_filter=name)
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)


@router.get("/index/{index_name}")
def index_quote(index_name: str):
    """Live quote for one index, e.g. 'NIFTY 50' (cm_get_index_quote)."""
    try:
        return get_nse_service().get_index_quote(index_name)
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)


@router.get("/history/{symbol}")
def stock_history(
    symbol: str,
    months: int = Query(3, ge=1, le=12),
    check_corporate_actions: bool = True,
):
    """Daily OHLCV, end-of-day and unadjusted (Bhavcopy: get_stock_history)."""
    try:
        return get_nse_service().get_stock_history(
            symbol, months=months, check_corporate_actions=check_corporate_actions
        )
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)


@router.get("/index-history/{index_name}")
def index_history(index_name: str, months: int = Query(3, ge=1, le=24)):
    """Daily index history (Bhavcopy: get_index_history)."""
    try:
        return get_nse_service().get_index_history(index_name, months=months)
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)


@router.get("/search")
def search_symbols(q: str = Query(..., min_length=2, max_length=40)):
    """Find NSE symbols by company name / partial symbol (Bhavcopy: search_symbols)."""
    try:
        return get_nse_service().search_symbols(q)
    except Exception as exc:  # noqa: BLE001
        _raise_http(exc)
