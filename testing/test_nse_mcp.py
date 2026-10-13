"""Tests for the NSE MCP integration. No network: the MCP client is replaced by a fake.

Payload shapes mirror what the live servers returned during discovery
(see docs/nse_mcp_integration.md).
"""
import threading
import time
import unittest
import unittest.mock

import pandas as pd
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.agents.research_agent import ResearchAgent
from backend.nse_routes import router
from data_ingestion import nse_market_service as svc
from data_ingestion.nse_market_service import (
    IST,
    NSEMarketDataService,
    NSESymbolError,
    assess_eod_freshness,
    assess_live_freshness,
    normalize_symbol,
)
from data_ingestion.nse_mcp_client import (
    BHAVCOPY_ENDPOINT,
    CM_MARKET_ENDPOINT,
    NSEMCPClient,
    NSEMCPConnectionError,
    NSEMCPDisabledError,
    NSEMCPTimeoutError,
    NSEMCPToolError,
)

# Tuesday 2026-10-13 11:50 IST, inside the trading session
NOW = datetime(2026, 10, 13, 11, 50, tzinfo=IST).astimezone(timezone.utc)


def stock_payload(**overrides):
    stock = {
        "type": "CM", "symbol": "RELIANCE", "series": "EQ", "openPrice": 1158.9, "highPrice": 1166.8,
        "lowPrice": 1152.2, "preClosePrice": 1158.9, "lastTradedPrice": 1153.5, "change": -5.4,
        "perChange": -0.47, "volume": 4742607, "fiftyTwoWeekHigh": 1611.8, "fiftyTwoWeekLow": 1152.2,
        "perChange30d": -8.26, "latestTimestamp": "2026-10-13 11:49:26",
    }
    stock.update(overrides)
    return {"updatedAt": "2026-10-13T06:19:26.223448151Z", "stock": stock}


def history_payload(rows, next_end_date="2026-07-01"):
    return {"symbol": "TCS", "data": rows, "next_end_date": next_end_date}


def bar(day, close=100.0, **kw):
    base = close if close is not None else 100.0
    row = {"date": day, "open": base, "high": base + 1, "low": base - 1, "close": close, "volume": 1000}
    row.update(kw)
    return row


class FakeClient:
    """Stands in for NSEMCPClient; routes (endpoint, tool) to canned payloads or exceptions."""

    endpoint_urls = {CM_MARKET_ENDPOINT: "https://cm.example/mcp", BHAVCOPY_ENDPOINT: "https://bhav.example/mcp"}

    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    def call_tool(self, endpoint, tool, arguments=None, deadline=None):
        self.deadlines = getattr(self, 'deadlines', []) + [deadline]
        self.calls.append((endpoint, tool, arguments))
        value = self.responses[tool]
        if callable(value):
            value = value(arguments)
        if isinstance(value, Exception):
            raise value
        return value

    def list_tools(self, endpoint):
        return [{"name": "x", "description": "d", "inputSchema": {}}]


def make_service(responses):
    return NSEMarketDataService(client=FakeClient(responses), clock=lambda: NOW)


class SymbolTests(unittest.TestCase):
    def test_normalizes_yfinance_style_symbols(self):
        self.assertEqual(normalize_symbol("reliance.ns"), "RELIANCE")
        self.assertEqual(normalize_symbol(" M&M "), "M&M")
        self.assertEqual(normalize_symbol("BAJAJ-AUTO"), "BAJAJ-AUTO")

    def test_rejects_bse_and_malformed(self):
        for bad in ("RELIANCE.BO", "", "a b", "X" * 40, "../etc"):
            with self.assertRaises(NSESymbolError, msg=bad):
                normalize_symbol(bad)


class FreshnessTests(unittest.TestCase):
    def test_live_during_session(self):
        ts = NOW.astimezone(IST) - timedelta(minutes=1)
        self.assertEqual(assess_live_freshness(ts, NOW)[0], "live")

    def test_delayed_and_stale_during_session(self):
        self.assertEqual(assess_live_freshness(NOW - timedelta(minutes=15), NOW)[0], "delayed")
        freshness, warnings = assess_live_freshness(NOW - timedelta(hours=3), NOW)
        self.assertEqual(freshness, "stale")
        self.assertTrue(warnings)

    def test_closed_after_hours_and_stale_when_old(self):
        saturday = datetime(2026, 10, 17, 12, 0, tzinfo=IST)
        friday_close = datetime(2026, 10, 16, 15, 30, tzinfo=IST)
        self.assertEqual(assess_live_freshness(friday_close, saturday)[0], "closed")
        self.assertEqual(assess_live_freshness(friday_close - timedelta(days=10), saturday)[0], "stale")

    def test_missing_or_future_timestamp_is_unknown(self):
        self.assertEqual(assess_live_freshness(None, NOW)[0], "unknown")
        self.assertEqual(assess_live_freshness(NOW + timedelta(hours=1), NOW)[0], "unknown")

    def test_eod_freshness(self):
        from datetime import date
        self.assertEqual(assess_eod_freshness(date(2026, 10, 12), NOW), ("eod", []))  # previous weekday
        freshness, warnings = assess_eod_freshness(date(2026, 10, 9), NOW)  # lags one session
        self.assertEqual(freshness, "eod")
        self.assertTrue(warnings)
        self.assertEqual(assess_eod_freshness(date(2026, 9, 1), NOW)[0], "stale")
        self.assertEqual(assess_eod_freshness(None, NOW)[0], "unknown")


class QuoteTests(unittest.TestCase):
    def test_valid_quote_has_attribution_and_live_freshness(self):
        quote = make_service({"cm_get_stock_quote": stock_payload()}).get_stock_quote("RELIANCE.NS")
        self.assertEqual(quote.symbol, "RELIANCE")
        self.assertEqual(quote.last_price, 1153.5)
        p = quote.provenance
        self.assertEqual((p.source, p.tool, p.freshness), ("NSE India MCP", "cm_get_stock_quote", "live"))
        self.assertEqual(p.endpoint_url, "https://cm.example/mcp")
        self.assertEqual(p.data_timestamp, "2026-10-13T11:49:26+05:30")
        self.assertEqual(p.warnings, [])
        self.assertIn("not investment advice", p.disclaimer)

    def test_missing_last_price_is_an_error_not_a_default(self):
        for bad in (None, 0, "n/a", float("nan")):
            service = make_service({"cm_get_stock_quote": stock_payload(lastTradedPrice=bad)})
            with self.assertRaises(svc.NSEMCPDataError, msg=str(bad)):
                service.get_stock_quote("RELIANCE")

    def test_symbol_mismatch_rejected(self):
        service = make_service({"cm_get_stock_quote": stock_payload(symbol="TCS")})
        with self.assertRaises(svc.NSEMCPDataError):
            service.get_stock_quote("RELIANCE")

    def test_missing_optional_fields_become_none_with_warnings(self):
        payload = stock_payload(fiftyTwoWeekHigh=0.0, fiftyTwoWeekLow=None, preClosePrice=None)
        quote = make_service({"cm_get_stock_quote": payload}).get_stock_quote("RELIANCE")
        self.assertIsNone(quote.fifty_two_week_high)
        self.assertIsNone(quote.fifty_two_week_low)
        self.assertIsNone(quote.previous_close)
        warnings = " ".join(quote.provenance.warnings)
        self.assertIn("52-week", warnings)
        self.assertIn("Previous close", warnings)

    def test_inverted_day_range_discarded(self):
        quote = make_service({"cm_get_stock_quote": stock_payload(highPrice=1100.0, lowPrice=1200.0)}).get_stock_quote("RELIANCE")
        self.assertIsNone(quote.high)
        self.assertTrue(any("day high" in w.lower() for w in quote.provenance.warnings))

    def test_old_timestamp_flagged_stale(self):
        payload = stock_payload(latestTimestamp="2026-10-13 09:20:00")
        quote = make_service({"cm_get_stock_quote": payload}).get_stock_quote("RELIANCE")
        self.assertEqual(quote.provenance.freshness, "stale")

    def test_unparseable_timestamp_is_unknown(self):
        quote = make_service({"cm_get_stock_quote": stock_payload(latestTimestamp="yesterday")}).get_stock_quote("RELIANCE")
        self.assertEqual(quote.provenance.freshness, "unknown")
        self.assertIsNone(quote.provenance.data_timestamp)

    def test_quotes_are_cached_briefly(self):
        service = make_service({"cm_get_stock_quote": stock_payload()})
        service.get_stock_quote("RELIANCE")
        service.get_stock_quote("reliance.ns")
        self.assertEqual(len(service.client.calls), 1)

    def test_index_quote(self):
        payload = {
            "nseTimestamp": "13-Oct-2026 11:49:33",
            "index": {"indexName": "NIFTY 50", "last": 22488.8, "previousClose": 22363.35, "change": 125.45,
                      "percChange": 0.56, "yearHigh": 26373.2, "yearLow": 22179.9},
        }
        quote = make_service({"cm_get_index_quote": payload}).get_index_quote("nifty 50")
        self.assertEqual(quote.last, 22488.8)
        self.assertEqual(quote.provenance.freshness, "live")
        self.assertEqual(quote.provenance.tool, "cm_get_index_quote")

    def test_index_quote_without_value_is_error(self):
        with self.assertRaises(svc.NSEMCPDataError):
            make_service({"cm_get_index_quote": {"index": {"indexName": "X"}}}).get_index_quote("X")


class HistoryTests(unittest.TestCase):
    def responses(self, rows, actions=None):
        return {
            "get_stock_history": history_payload(rows),
            "get_corporate_actions": actions if actions is not None else {"symbol": "TCS", "count": 0, "actions": []},
        }

    def test_valid_history_sorted_deduped_with_provenance(self):
        rows = [bar("2026-10-12", 105), bar("2026-10-09", 104), bar("2026-10-09", 104)]
        history = make_service(self.responses(rows)).get_stock_history("TCS", months=1)
        self.assertEqual([b.date for b in history.bars], ["2026-10-09", "2026-10-12"])
        self.assertFalse(history.price_adjusted)
        self.assertTrue(history.corporate_actions_checked)
        self.assertEqual(history.provenance.freshness, "eod")
        self.assertEqual(history.provenance.as_of_date, "2026-10-12")
        self.assertTrue(any("not adjusted" in w for w in history.provenance.warnings))

    def test_bad_rows_dropped_and_reported(self):
        rows = [bar("2026-10-09"), bar("2026-10-12", close=None), bar("not-a-date"), bar("2026-10-10", close=-3)]
        history = make_service(self.responses(rows)).get_stock_history("TCS", months=1)
        self.assertEqual(len(history.bars), 1)
        self.assertTrue(any("Dropped 3" in w for w in history.provenance.warnings))

    def test_all_rows_invalid_is_error(self):
        with self.assertRaises(svc.NSEMCPDataError):
            make_service(self.responses([bar("2026-10-12", close=None)])).get_stock_history("TCS", months=1)

    def test_split_in_window_is_flagged(self):
        actions = {"actions": [
            {"exDate": "2026-09-01", "actionType": "DIVIDEND", "purpose": "Dividend", "adjustmentFactor": 1.0},
            {"exDate": "2026-09-15", "actionType": "SPLIT", "purpose": "Split 1:2", "adjustmentFactor": 0.5},
        ]}
        history = make_service(self.responses([bar("2026-10-12")], actions)).get_stock_history("TCS", months=1)
        self.assertEqual(len(history.price_affecting_actions), 1)
        self.assertEqual(history.price_affecting_actions[0].ex_date, "2026-09-15")
        self.assertTrue(any("NOT adjusted" in w for w in history.provenance.warnings))

    def test_corporate_action_lookup_failure_is_visible(self):
        responses = self.responses([bar("2026-10-12")], NSEMCPTimeoutError("slow"))
        history = make_service(responses).get_stock_history("TCS", months=1)
        self.assertFalse(history.corporate_actions_checked)
        self.assertTrue(any("check unavailable" in w for w in history.provenance.warnings))

    def test_incomplete_corporate_action_list_is_not_treated_as_clean(self):
        responses = self.responses([bar("2026-10-12")], {"actions": [], "warning": "partial"})
        self.assertFalse(make_service(responses).get_stock_history("TCS", months=1).corporate_actions_checked)

    def test_chains_next_end_date_for_long_ranges(self):
        pages = iter([
            history_payload([bar("2026-10-12")], next_end_date="2026-07-12"),
            history_payload([bar("2026-07-10")], next_end_date="2026-04-10"),
        ])
        responses = {"get_stock_history": lambda args: next(pages), "get_corporate_actions": {"actions": []}}
        service = make_service(responses)
        history = service.get_stock_history("TCS", months=6)
        history_calls = [c for c in service.client.calls if c[1] == "get_stock_history"]
        self.assertEqual([c[2]["endDate"] for c in history_calls], ["today", "2026-07-12"])
        self.assertTrue(all(c[2]["months"] == 3 for c in history_calls))
        self.assertEqual(len(history.bars), 2)

    def test_unverified_history_is_not_cached(self):
        responses = self.responses([bar("2026-10-12")], NSEMCPTimeoutError("slow"))
        service = make_service(responses)
        self.assertFalse(service.get_stock_history("TCS", months=1).corporate_actions_checked)
        responses["get_corporate_actions"] = {"actions": []}
        self.assertTrue(service.get_stock_history("TCS", months=1).corporate_actions_checked)

    def test_verified_history_is_cached(self):
        service = make_service(self.responses([bar("2026-10-12")]))
        service.get_stock_history("TCS", months=1)
        service.get_stock_history("TCS", months=1)
        self.assertEqual(len([c for c in service.client.calls if c[1] == "get_stock_history"]), 1)

    def test_months_bounds(self):
        service = make_service(self.responses([bar("2026-10-12")]))
        for bad in (0, 13, "x"):
            with self.assertRaises(NSESymbolError):
                service.get_stock_history("TCS", months=bad)


class ConcurrencyAndWindowTests(unittest.TestCase):
    def test_history_and_corporate_actions_run_concurrently(self):
        barrier = threading.Barrier(2, timeout=5)  # serial execution would break the barrier

        def meet(payload):
            def handler(args):
                barrier.wait()
                return payload
            return handler

        service = make_service({
            "get_stock_history": meet(history_payload([bar("2026-10-12")])),
            "get_corporate_actions": meet({"actions": []}),
        })
        history = service.get_stock_history("TCS", months=1)
        self.assertTrue(history.corporate_actions_checked)

    def test_deadline_is_forwarded_to_every_upstream_call(self):
        service = make_service({
            "get_stock_history": history_payload([bar("2026-10-12")]),
            "get_corporate_actions": {"actions": []},
        })
        service.get_stock_history("TCS", months=1, deadline=12345.0)
        self.assertEqual(service.client.deadlines, [12345.0, 12345.0])

    def test_history_older_than_checked_window_is_unverified(self):
        old = [bar("2026-01-05"), bar("2026-10-12")]  # starts before the 1-month action window
        service = make_service({"get_stock_history": history_payload(old), "get_corporate_actions": {"actions": []}})
        history = service.get_stock_history("TCS", months=1)
        self.assertFalse(history.corporate_actions_checked)
        self.assertTrue(any("beyond the checked window" in w for w in history.provenance.warnings))


class DeadlineClientTests(unittest.TestCase):
    def hung_server(self):
        import socket
        srv = socket.socket()
        srv.bind(("127.0.0.1", 0))
        srv.listen(5)
        self.addCleanup(srv.close)
        return f"http://127.0.0.1:{srv.getsockname()[1]}/mcp"

    def test_deadline_caps_total_time_across_retries(self):
        client = NSEMCPClient(endpoint_urls={CM_MARKET_ENDPOINT: self.hung_server()}, timeout=10, attempts=3, cooldown_seconds=30)
        start = time.monotonic()
        with self.assertRaises(NSEMCPTimeoutError):
            client.call_tool(CM_MARKET_ENDPOINT, "cm_get_data_status", deadline=time.monotonic() + 1.5)
        self.assertLess(time.monotonic() - start, 5)

    def test_hung_attempt_starts_cooldown_so_next_call_fails_fast(self):
        client = NSEMCPClient(endpoint_urls={CM_MARKET_ENDPOINT: self.hung_server()}, timeout=10, attempts=2, cooldown_seconds=30)
        with self.assertRaises(NSEMCPTimeoutError):
            client.call_tool(CM_MARKET_ENDPOINT, "cm_get_data_status", deadline=time.monotonic() + 1.0)
        start = time.monotonic()
        with self.assertRaises(NSEMCPConnectionError) as ctx:
            client.call_tool(CM_MARKET_ENDPOINT, "cm_get_data_status", deadline=time.monotonic() + 5)
        self.assertIn("cooling down", str(ctx.exception))
        self.assertLess(time.monotonic() - start, 0.5)

    def test_spent_budget_never_connects_and_does_not_trigger_cooldown(self):
        client = NSEMCPClient(endpoint_urls={CM_MARKET_ENDPOINT: "http://127.0.0.1:9/mcp"}, timeout=10, attempts=3)
        start = time.monotonic()
        with self.assertRaises(NSEMCPTimeoutError):
            client.call_tool(CM_MARKET_ENDPOINT, "cm_get_data_status", deadline=time.monotonic() - 1)
        self.assertLess(time.monotonic() - start, 0.5)
        self.assertEqual(client._cooldown_until, {})


class ClientTests(unittest.TestCase):
    def test_decode_error_body_raises_tool_error(self):
        result = SimpleNamespace(isError=False, content=[SimpleNamespace(type="text", text='{"error":"Symbol \'X\' not found","hint":"h"}')])
        with self.assertRaises(NSEMCPToolError) as ctx:
            NSEMCPClient._decode("cm_get_stock_quote", result)
        self.assertEqual(ctx.exception.hint, "h")

    def test_decode_json_and_bare_string(self):
        ok = SimpleNamespace(isError=False, content=[SimpleNamespace(type="text", text='{"a":1}')])
        self.assertEqual(NSEMCPClient._decode("t", ok), {"a": 1})
        bare = SimpleNamespace(isError=False, content=[SimpleNamespace(type="text", text="2156.0")])
        self.assertEqual(NSEMCPClient._decode("t", bare), 2156.0)

    def test_decode_empty_content_is_connection_error(self):
        with self.assertRaises(NSEMCPConnectionError):
            NSEMCPClient._decode("t", SimpleNamespace(isError=False, content=[]))

    def test_disabled_flag(self):
        import os
        os.environ["NSE_MCP_ENABLED"] = "false"
        try:
            with self.assertRaises(NSEMCPDisabledError):
                NSEMCPClient().call_tool(CM_MARKET_ENDPOINT, "cm_get_data_status")
        finally:
            del os.environ["NSE_MCP_ENABLED"]

    def test_hung_server_times_out_instead_of_blocking(self):
        import socket, time
        srv = socket.socket(); srv.bind(("127.0.0.1", 0)); srv.listen(5)  # accepts, never answers
        self.addCleanup(srv.close)
        client = NSEMCPClient(
            endpoint_urls={CM_MARKET_ENDPOINT: f"http://127.0.0.1:{srv.getsockname()[1]}/mcp"}, timeout=1, attempts=1
        )
        start = time.monotonic()
        with self.assertRaises(NSEMCPTimeoutError):
            client.call_tool(CM_MARKET_ENDPOINT, "cm_get_data_status")
        self.assertLess(time.monotonic() - start, 8)

    def test_unreachable_server_retries_then_cools_down(self):
        client = NSEMCPClient(
            endpoint_urls={CM_MARKET_ENDPOINT: "http://127.0.0.1:9/mcp"}, timeout=2, attempts=2, cooldown_seconds=30
        )
        with self.assertRaises(NSEMCPConnectionError):
            client.call_tool(CM_MARKET_ENDPOINT, "cm_get_data_status")
        with self.assertRaises(NSEMCPConnectionError) as ctx:  # second call fails fast
            client.call_tool(CM_MARKET_ENDPOINT, "cm_get_data_status")
        self.assertIn("cooling down", str(ctx.exception))


class RouteTests(unittest.TestCase):
    def client_with(self, responses):
        app = FastAPI()
        app.include_router(router)
        self._patch = unittest.mock.patch("backend.nse_routes.get_nse_service", return_value=make_service(responses))
        self._patch.start()
        self.addCleanup(self._patch.stop)
        return TestClient(app)

    def test_quote_ok_includes_provenance(self):
        body = self.client_with({"cm_get_stock_quote": stock_payload()}).get("/market/nse/quote/RELIANCE").json()
        self.assertEqual(body["provenance"]["tool"], "cm_get_stock_quote")

    def test_unknown_symbol_404(self):
        client = self.client_with({"cm_get_stock_quote": NSEMCPToolError("Symbol 'X' not found", "cm_get_stock_quote")})
        self.assertEqual(client.get("/market/nse/quote/NOSUCH").status_code, 404)

    def test_bad_symbol_422(self):
        self.assertEqual(self.client_with({}).get("/market/nse/quote/RELIANCE.BO").status_code, 422)

    def test_timeout_504_and_outage_502_and_bad_data_502(self):
        self.assertEqual(self.client_with({"cm_get_stock_quote": NSEMCPTimeoutError("t")}).get("/market/nse/quote/TCS").status_code, 504)
        self.assertEqual(self.client_with({"cm_get_stock_quote": NSEMCPConnectionError("c")}).get("/market/nse/quote/TCS").status_code, 502)
        self.assertEqual(self.client_with({"cm_get_stock_quote": {"stock": {}}}).get("/market/nse/quote/TCS").status_code, 502)

    def test_disabled_503(self):
        client = self.client_with({"cm_get_stock_quote": NSEMCPDisabledError("off")})
        self.assertEqual(client.get("/market/nse/quote/TCS").status_code, 503)

    def test_history_validates_months(self):
        self.assertEqual(self.client_with({}).get("/market/nse/history/TCS?months=99").status_code, 422)


class _StubAgent:
    def __getattr__(self, name):
        raise AssertionError(f"unexpected call to {name}")


class ResearchIntegrationTests(unittest.TestCase):
    def agent(self, service, yahoo_frame=None):
        agent = ResearchAgent(
            api_agent=_StubAgent(), scraping_agent=_StubAgent(), retriever_agent=_StubAgent(),
            language_agent=_StubAgent(), nse_service=service,
        )
        agent._fetch_market_frame = lambda symbol: yahoo_frame
        return agent

    def nse_rows(self, n=57):
        start = datetime(2026, 8, 17)  # inside the corporate-action window checked for a 3-month history
        days = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n)]
        return [bar(d, 100 + i) for i, d in enumerate(days)]

    def service(self, quote=None, rows=None, actions=None):
        return make_service({
            "cm_get_stock_quote": quote if quote is not None else stock_payload(),
            "get_stock_history": history_payload(rows or self.nse_rows()),
            "get_corporate_actions": actions if actions is not None else {"actions": []},
        })

    def run_pipeline(self, agent, symbol="RELIANCE.NS"):
        nse = agent._fetch_nse_market_data(symbol)
        frame, source = agent._select_market_frame(symbol, nse)
        indicators = agent._build_technical_indicators(frame)
        meta = agent._apply_nse_quote(indicators, nse, source)
        return indicators, meta, source

    def test_nse_symbol_uses_nse_history_and_live_quote_with_attribution(self):
        indicators, meta, source = self.run_pipeline(self.agent(self.service()))
        self.assertEqual(source, "nse")
        self.assertEqual(indicators.latest_close, 1153.5)  # live quote overlays EOD close
        self.assertEqual(indicators.high_52_week, 1611.8)  # from the quote, not from 6 months of bars
        self.assertIsNotNone(indicators.moving_average_50)
        self.assertEqual((meta["source"], meta["freshness"]), ("NSE India MCP", "live"))
        self.assertTrue(any("cm_get_stock_quote" in s for s in meta["sources"]))
        self.assertTrue(any("get_stock_history" in s for s in meta["sources"]))

    def test_non_nse_symbol_never_calls_nse(self):
        service = self.service()
        agent = self.agent(service, yahoo_frame=pd.DataFrame({"Close": [1.0, 2.0], "Volume": [1, 1]}))
        _, meta, source = self.run_pipeline(agent, "MSFT")
        self.assertEqual(source, "yahoo")
        self.assertEqual(service.client.calls, [])
        self.assertEqual(meta["source"], "Yahoo Finance (yfinance)")

    def test_split_in_window_falls_back_to_yahoo(self):
        actions = {"actions": [{"exDate": "2026-08-01", "actionType": "BONUS", "purpose": "Bonus 1:1", "adjustmentFactor": 0.5}]}
        yahoo = pd.DataFrame({"Close": [10.0, 11.0], "Volume": [1, 1]})
        _, meta, source = self.run_pipeline(self.agent(self.service(actions=actions), yahoo_frame=yahoo))
        self.assertEqual(source, "yahoo")
        self.assertTrue(any("not used" in w for w in meta["warnings"]))

    def test_nse_outage_falls_back_to_yahoo_without_raising(self):
        service = make_service({
            "cm_get_stock_quote": NSEMCPTimeoutError("timeout"),
            "get_stock_history": NSEMCPConnectionError("down"),
            "get_corporate_actions": NSEMCPConnectionError("down"),
        })
        yahoo = pd.DataFrame({"Close": [10.0, 11.0], "Volume": [1, 1]})
        indicators, meta, source = self.run_pipeline(self.agent(service, yahoo_frame=yahoo))
        self.assertEqual(source, "yahoo")
        self.assertEqual(indicators.latest_close, 11.0)
        self.assertEqual(meta["source"], "Yahoo Finance (yfinance)")
        self.assertTrue(any("unavailable" in w for w in meta["warnings"]))

    def test_stale_live_quote_is_not_applied(self):
        stale = stock_payload(latestTimestamp="2026-10-13 09:20:00")
        indicators, meta, _ = self.run_pipeline(self.agent(self.service(quote=stale)))
        self.assertNotEqual(indicators.latest_close, 1153.5)
        self.assertIsNone(indicators.high_52_week)  # no fabricated 52w range from 6 months of bars
        self.assertTrue(any("ignored" in w for w in meta["warnings"]))

    # ---- latency budget / concurrency / fallback
    def budget_agent(self, service, budget, yahoo_frame=None):
        agent = self.agent(service, yahoo_frame=yahoo_frame)
        agent.nse_budget_seconds = budget
        return agent

    def test_quote_and_history_are_requested_concurrently(self):
        barrier = threading.Barrier(2, timeout=5)

        class Service:
            def get_stock_quote(self, symbol, deadline=None):
                barrier.wait()
                return "quote"

            def get_stock_history(self, symbol, months=3, deadline=None):
                barrier.wait()
                return "history"

        data = self.budget_agent(Service(), 5)._fetch_nse_market_data("RELIANCE.NS")
        self.assertEqual((data.quote, data.history), ("quote", "history"))

    def test_hung_history_is_abandoned_at_the_budget_and_quote_is_kept(self):
        release = threading.Event()
        self.addCleanup(release.set)
        quote = make_service({"cm_get_stock_quote": stock_payload()}).get_stock_quote("RELIANCE")

        class Service:
            def get_stock_quote(self, symbol, deadline=None):
                return quote

            def get_stock_history(self, symbol, months=3, deadline=None):
                release.wait(30)  # ignores the deadline, like a worst-case hang
                raise AssertionError("should have been abandoned")

        start = time.monotonic()
        data = self.budget_agent(Service(), 0.5)._fetch_nse_market_data("RELIANCE.NS")
        self.assertLess(time.monotonic() - start, 3)
        self.assertIs(data.quote, quote)
        self.assertIsNone(data.history)
        self.assertTrue(any("budget" in w for w in data.warnings))

    def test_both_requests_failing_concurrently_yield_warnings_not_exceptions(self):
        class Service:
            def get_stock_quote(self, symbol, deadline=None):
                raise NSEMCPTimeoutError("quote hung")

            def get_stock_history(self, symbol, months=3, deadline=None):
                raise NSEMCPConnectionError("history down")

        data = self.budget_agent(Service(), 2)._fetch_nse_market_data("TCS.NS")
        self.assertEqual((data.quote, data.history), (None, None))
        joined = " | ".join(data.warnings)
        self.assertIn("quote hung", joined)
        self.assertIn("history down", joined)

    def test_total_enrichment_time_is_bounded_with_real_client_and_hung_server(self):
        import socket
        srv = socket.socket()
        srv.bind(("127.0.0.1", 0))
        srv.listen(5)
        self.addCleanup(srv.close)
        url = f"http://127.0.0.1:{srv.getsockname()[1]}/mcp"
        client = NSEMCPClient(
            endpoint_urls={CM_MARKET_ENDPOINT: url, BHAVCOPY_ENDPOINT: url}, timeout=10, attempts=3, cooldown_seconds=30
        )
        yahoo = pd.DataFrame({"Close": [10.0, 11.0], "Volume": [1, 1]})
        agent = self.budget_agent(NSEMarketDataService(client=client), 1.5, yahoo_frame=yahoo)
        start = time.monotonic()
        indicators, meta, source = self.run_pipeline(agent)
        self.assertLess(time.monotonic() - start, 5)  # was 30-60s before the budget
        self.assertEqual(source, "yahoo")
        self.assertEqual(indicators.latest_close, 11.0)
        # the hang started cooldown on both endpoints: the next symbol is refused without a connection
        self.assertEqual(set(client._cooldown_until), {CM_MARKET_ENDPOINT, BHAVCOPY_ENDPOINT})
        start = time.monotonic()
        nse = agent._fetch_nse_market_data("TCS.NS")
        self.assertLess(time.monotonic() - start, 1.4)  # well under the 1.5s budget it would otherwise burn
        self.assertTrue(all("cooling down" in w for w in nse.warnings) and len(nse.warnings) == 2)

    def test_failed_corporate_action_check_never_makes_nse_history_trusted(self):
        service = make_service({
            "cm_get_stock_quote": stock_payload(),
            "get_stock_history": history_payload(self.nse_rows()),
            "get_corporate_actions": NSEMCPTimeoutError("actions hung"),
        })
        yahoo = pd.DataFrame({"Close": [10.0, 11.0], "Volume": [1, 1]})
        _, meta, source = self.run_pipeline(self.agent(service, yahoo_frame=yahoo))
        self.assertEqual(source, "yahoo")  # unverified NSE bars are not used while yfinance is available
        self.assertTrue(any("check unavailable" in w for w in meta["warnings"]))

    def test_unverified_nse_history_only_used_as_last_resort_and_labelled(self):
        service = make_service({
            "cm_get_stock_quote": stock_payload(),
            "get_stock_history": history_payload(self.nse_rows()),
            "get_corporate_actions": NSEMCPTimeoutError("actions hung"),
        })
        _, meta, source = self.run_pipeline(self.agent(service, yahoo_frame=None))
        self.assertEqual(source, "nse")
        self.assertTrue(any("without a completed corporate-action check" in w for w in meta["warnings"]))


if __name__ == "__main__":
    unittest.main()
