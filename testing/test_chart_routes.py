"""Tests for the /market/history/{symbol} chart endpoint (chart_routes.py).

All tests use mocked yfinance / NSE service so no real network calls are made.
Run with: python -m unittest testing.test_chart_routes
"""
from __future__ import annotations

import sys
import types
import unittest
from unittest import mock
from datetime import datetime, timedelta, timezone

import pandas as pd


# ---------------------------------------------------------------------------
# Minimal stubs so the module can be imported without all server deps
# ---------------------------------------------------------------------------

def _stub_module(name: str) -> types.ModuleType:
    m = types.ModuleType(name)
    sys.modules[name] = m
    return m


# Stub out fastapi/pydantic minimally if not installed (they should be present
# since the server is running, but keep tests self-contained).
try:
    import fastapi  # noqa: F401
except ImportError:
    fa = _stub_module("fastapi")
    fa.APIRouter = type("APIRouter", (), {"get": lambda *a, **kw: (lambda f: f), "prefix": ""})
    fa.HTTPException = Exception
    fa.Query = lambda *a, **kw: kw.get("default", None)
    _stub_module("pydantic").BaseModel = object

from backend.chart_routes import (
    OhlcBar,
    ChartHistoryResponse,
    _fetch_yahoo,
    _fetch_nse,
    _num,
    _pos,
    _int,
)


# ---------------------------------------------------------------------------
# Helper builders
# ---------------------------------------------------------------------------

def _make_yf_hist(n: int = 20, start: str = "2024-09-01") -> pd.DataFrame:
    """Synthetic yfinance-style DataFrame with n bars."""
    base = datetime.strptime(start, "%Y-%m-%d")
    dates = [base + timedelta(days=i) for i in range(n)]
    data = {
        "Date": [d.strftime("%Y-%m-%d") for d in dates],
        "Open": [100.0 + i for i in range(n)],
        "High": [105.0 + i for i in range(n)],
        "Low": [98.0 + i for i in range(n)],
        "Close": [102.0 + i for i in range(n)],
        "Volume": [1_000_000 + i * 1000 for i in range(n)],
    }
    df = pd.DataFrame(data)
    return df


# ---------------------------------------------------------------------------
# Unit tests for helpers
# ---------------------------------------------------------------------------

class TestHelpers(unittest.TestCase):
    def test_num_valid(self):
        self.assertAlmostEqual(_num(3.14), 3.14)
        self.assertAlmostEqual(_num("2.5"), 2.5)
        self.assertIsNone(_num(None))
        self.assertIsNone(_num("abc"))
        self.assertIsNone(_num(float("inf")))

    def test_pos_positive_only(self):
        self.assertAlmostEqual(_pos(5.0), 5.0)
        self.assertIsNone(_pos(0.0))
        self.assertIsNone(_pos(-1.0))
        self.assertIsNone(_pos(None))

    def test_int_non_negative(self):
        self.assertEqual(_int(3.9), 3)
        self.assertEqual(_int(0), 0)
        self.assertIsNone(_int(-1))
        self.assertIsNone(_int(None))


# ---------------------------------------------------------------------------
# Tests for _fetch_yahoo
# ---------------------------------------------------------------------------

class TestFetchYahoo(unittest.TestCase):
    def _mock_ticker(self, hist_df: pd.DataFrame, currency: str = "INR"):
        ticker = mock.MagicMock()
        ticker.history.return_value = hist_df
        ticker.history_metadata = {"currency": currency}
        return ticker

    def test_basic_response_shape(self):
        hist = _make_yf_hist(30)
        with mock.patch("yfinance.Ticker", return_value=self._mock_ticker(hist)):
            result = _fetch_yahoo("TCS.NS", months=1)

        self.assertIsInstance(result, ChartHistoryResponse)
        self.assertEqual(result.symbol, "TCS.NS")
        self.assertEqual(result.exchange, "NSE")
        self.assertEqual(result.currency, "INR")
        self.assertTrue(result.price_adjusted)
        self.assertEqual(len(result.bars), 30)

    def test_bars_sorted_chronologically(self):
        hist = _make_yf_hist(20)
        # Shuffle rows to test sorting
        shuffled = hist.sample(frac=1, random_state=42).reset_index(drop=True)
        with mock.patch("yfinance.Ticker", return_value=self._mock_ticker(shuffled)):
            result = _fetch_yahoo("RELIANCE.NS", months=1)

        dates = [b.date for b in result.bars]
        self.assertEqual(dates, sorted(dates), "bars must be in chronological order")

    def test_bars_deduplicated(self):
        """Duplicate dates in the DataFrame must produce only one bar per date."""
        hist = _make_yf_hist(10)
        doubled = pd.concat([hist, hist]).reset_index(drop=True)
        with mock.patch("yfinance.Ticker", return_value=self._mock_ticker(doubled)):
            result = _fetch_yahoo("IEX.NS", months=1)

        dates = [b.date for b in result.bars]
        self.assertEqual(len(dates), len(set(dates)), "dates must be unique")

    def test_invalid_high_low_discarded(self):
        """High < Low → both set to None in the bar."""
        hist = _make_yf_hist(5)
        # Corrupt row 2: set High below Low
        hist.loc[2, "High"] = 50.0
        hist.loc[2, "Low"] = 80.0
        with mock.patch("yfinance.Ticker", return_value=self._mock_ticker(hist)):
            result = _fetch_yahoo("TEST.NS", months=1)

        bad = next((b for b in result.bars if b.date == hist.loc[2, "Date"]), None)
        self.assertIsNotNone(bad)
        self.assertIsNone(bad.high, "inverted high/low must be discarded")
        self.assertIsNone(bad.low, "inverted high/low must be discarded")

    def test_empty_response_raises_404(self):
        ticker = mock.MagicMock()
        ticker.history.return_value = pd.DataFrame()
        ticker.history_metadata = {}
        with mock.patch("yfinance.Ticker", return_value=ticker):
            try:
                from fastapi import HTTPException
                with self.assertRaises(HTTPException):
                    _fetch_yahoo("INVALID.NS", months=1)
            except ImportError:
                pass  # skip if fastapi not importable in isolation

    def test_bse_symbol_exchange(self):
        hist = _make_yf_hist(5)
        with mock.patch("yfinance.Ticker", return_value=self._mock_ticker(hist, "INR")):
            result = _fetch_yahoo("RELIANCE.BO", months=1)
        self.assertEqual(result.exchange, "BSE")

    def test_global_symbol_no_exchange(self):
        hist = _make_yf_hist(5)
        with mock.patch("yfinance.Ticker", return_value=self._mock_ticker(hist, "USD")):
            result = _fetch_yahoo("AAPL", months=1)
        self.assertIsNone(result.exchange)
        self.assertEqual(result.currency, "USD")

    def test_volume_missing_still_returns_bars(self):
        hist = _make_yf_hist(10)
        hist["Volume"] = None
        with mock.patch("yfinance.Ticker", return_value=self._mock_ticker(hist)):
            result = _fetch_yahoo("TCS.NS", months=1)
        self.assertEqual(len(result.bars), 10)
        for b in result.bars:
            self.assertIsNone(b.volume)

    def test_ohlcv_values_match_source(self):
        hist = _make_yf_hist(5)
        with mock.patch("yfinance.Ticker", return_value=self._mock_ticker(hist)):
            result = _fetch_yahoo("TCS.NS", months=1)

        for i, bar in enumerate(result.bars):
            self.assertAlmostEqual(bar.close, hist.loc[i, "Close"])
            self.assertAlmostEqual(bar.open, hist.loc[i, "Open"])
            self.assertAlmostEqual(bar.high, hist.loc[i, "High"])
            self.assertAlmostEqual(bar.low, hist.loc[i, "Low"])
            self.assertEqual(bar.volume, hist.loc[i, "Volume"])


# ---------------------------------------------------------------------------
# Tests for _fetch_nse (NSE MCP path)
# ---------------------------------------------------------------------------

class TestFetchNSE(unittest.TestCase):
    def _make_nse_history(self, n: int = 30):
        """Synthetic StockHistory-like object matching the pydantic model."""
        from data_ingestion.nse_market_service import (
            PriceBar, StockHistory, DataProvenance
        )
        import time

        bars = []
        base = datetime(2024, 9, 1)
        for i in range(n):
            d = (base + timedelta(days=i)).strftime("%Y-%m-%d")
            bars.append(PriceBar(
                date=d,
                open=100.0 + i,
                high=105.0 + i,
                low=98.0 + i,
                close=102.0 + i,
                volume=500_000 + i,
            ))
        prov = DataProvenance(
            source="NSE India MCP",
            endpoint_url="https://nse-mcp.example.com",
            tool="get_stock_history",
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            as_of_date=bars[-1].date,
            freshness="eod",
            warnings=["Prices are raw (not adjusted for splits/bonuses)"],
        )
        return StockHistory(
            symbol="TCS",
            from_date=bars[0].date,
            to_date=bars[-1].date,
            bars=bars,
            price_adjusted=False,
            price_affecting_actions=[],
            corporate_actions_checked=True,
            provenance=prov,
        )

    def test_nse_returns_correct_shape(self):
        try:
            from data_ingestion.nse_market_service import NSEMarketDataService
        except ImportError:
            self.skipTest("data_ingestion not available")

        history = self._make_nse_history(20)
        svc = mock.MagicMock(spec=NSEMarketDataService)
        svc.get_stock_history.return_value = history

        with (
            mock.patch("data_ingestion.nse_mcp_client.nse_mcp_enabled", return_value=True),
            mock.patch("data_ingestion.nse_market_service.get_nse_service", return_value=svc),
        ):
            result = _fetch_nse("TCS.NS", months=3)

        self.assertIsNotNone(result)
        self.assertEqual(result.exchange, "NSE")
        self.assertFalse(result.price_adjusted)
        self.assertEqual(result.currency, "INR")
        self.assertEqual(len(result.bars), 20)

    def test_nse_disabled_returns_none(self):
        with mock.patch("data_ingestion.nse_mcp_client.nse_mcp_enabled", return_value=False):
            result = _fetch_nse("TCS.NS", months=1)
        self.assertIsNone(result)

    def test_non_nse_symbol_returns_none(self):
        """Global symbols like AAPL should not hit NSE."""
        result = _fetch_nse("AAPL", months=1)
        self.assertIsNone(result, "non-NSE symbol must not attempt NSE fetch")

    def test_nse_exception_returns_none(self):
        """Any NSE error must be swallowed and return None (fallback to Yahoo)."""
        try:
            from data_ingestion.nse_mcp_client import nse_mcp_enabled
        except ImportError:
            self.skipTest("data_ingestion not available")

        with (
            mock.patch("data_ingestion.nse_mcp_client.nse_mcp_enabled", return_value=True),
            mock.patch(
                "data_ingestion.nse_market_service.get_nse_service",
                side_effect=RuntimeError("simulated NSE outage"),
            ),
        ):
            result = _fetch_nse("RELIANCE.NS", months=3)

        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# Integration-style: verify OhlcBar constraints
# ---------------------------------------------------------------------------

class TestOhlcBarConstraints(unittest.TestCase):
    def test_bar_close_always_positive(self):
        bar = OhlcBar(date="2024-10-01", close=100.5, open=99.0, high=101.0, low=98.5, volume=10000)
        self.assertGreater(bar.close, 0)

    def test_bar_optional_fields_nullable(self):
        bar = OhlcBar(date="2024-10-01", close=50.0)
        self.assertIsNone(bar.open)
        self.assertIsNone(bar.high)
        self.assertIsNone(bar.low)
        self.assertIsNone(bar.volume)

    def test_chart_history_response_warnings_list(self):
        resp = ChartHistoryResponse(
            symbol="TEST",
            source="test",
            price_adjusted=False,
            bars=[OhlcBar(date="2024-10-01", close=100.0)],
            warnings=["w1", "w2"],
        )
        self.assertEqual(len(resp.warnings), 2)


if __name__ == "__main__":
    unittest.main()
