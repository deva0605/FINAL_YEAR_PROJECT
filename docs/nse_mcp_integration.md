# NSE MCP integration

Market data for NSE-listed (`.NS`) stocks and NSE indices comes from NSE India's remote MCP servers,
accessed **only by the backend** (the browser never contacts NSE and no credentials are involved).

| Endpoint key | URL | Purpose |
|---|---|---|
| `cm_market` | `https://mcp.nseindia.in/cmmkt/mcp` | Live cash-market quotes, live indices, gainers/losers |
| `bhavcopy` | `https://mcp.nseindia.in/bhavcopy/cm/mcp` | End-of-day history, index history, corporate actions, analytics |

Both are unauthenticated Streamable-HTTP MCP servers (protocol `2025-06-18`), verified with `mcp==1.30.0`.

## Code map

| File | Role |
|---|---|
| `data_ingestion/nse_mcp_client.py` | Sync, thread-safe MCP client: per-attempt timeout, retries, per-endpoint cooldown, tool-error detection |
| `data_ingestion/nse_market_service.py` | Typed models, validation, freshness rules, source attribution, TTL cache |
| `backend/nse_routes.py` | FastAPI routes under `/market/nse/*` (included in `orchestrator/orchestrator.py`) |
| `backend/agents/research_agent.py` | `ResearchAgent` uses NSE for `.NS` symbols, falls back to yfinance |
| `testing/test_nse_mcp.py` | 56 offline tests (`python -m unittest testing.test_nse_mcp`) |

## Routes

| Route | NSE tool | Data |
|---|---|---|
| `GET /market/nse/quote/{symbol}` | `cm_get_stock_quote` | Live quote incl. 52-week high/low |
| `GET /market/nse/index/{name}` | `cm_get_index_quote` | Live index quote (e.g. `NIFTY 50`, `INDIA VIX`) |
| `GET /market/nse/indices?group=&name=` | `cm_get_live_indices` | Live values of many indices |
| `GET /market/nse/history/{symbol}?months=1..12` | `get_stock_history` + `get_corporate_actions` | Daily OHLCV (EOD, **unadjusted**) |
| `GET /market/nse/index-history/{name}?months=1..24` | `get_index_history` | Daily index OHLC |
| `GET /market/nse/search?q=` | `search_symbols` | Symbol lookup |
| `GET /market/nse/tools` | `list_tools` | Live tool catalogue of both servers |

Status codes: `404` unknown symbol, `422` invalid input, `502` upstream unreachable/unusable data,
`503` integration disabled, `504` upstream timeout. Every data response includes a `provenance` block
(`source`, `endpoint_url`, `tool`, `retrieved_at`, `data_timestamp`, `as_of_date`, `freshness`, `warnings`, `disclaimer`).

## Verified tool inventory (discovered 2026-10-13)

**cm_market** (16 tools): `cm_get_stock_quote(symbol)`, `cm_get_index_quote(indexName)`,
`cm_get_live_indices(group, nameFilter)`, `cm_get_equity_stocks(limit, symbolFilter)`,
`cm_get_sme_stocks`, `cm_get_bond_stocks`, `cm_get_call_auction_stocks` (same args),
`cm_get_live_market_data(index: gainers|loosers)`, `cm_get_live_gainers`, `cm_get_live_losers`,
`nse_get_gainers(limit)`, `nse_get_losers(limit)`, `nse_get_market_movers(indexName, limit)`,
`cm_get_data_status`, `cm_get_allstocks_status`.

**bhavcopy** (21 tools): history `get_stock_history(symbol, months<=3, endDate)`,
`get_index_history(indexName, months<=12, endDate)`, `get_index_snapshot(date, filter)`,
`get_ltp_by_date`, `get_bulk_quote(symbols<=50)`; analytics `moving_average`, `get_52_week_high_low`,
`get_volume_analysis`, `get_index_performance`, `get_index_valuation`, `compare_stocks`, `compare_indices`,
`get_stock_vs_index`, `get_top_movers`, `get_top_by_volume`, `get_index_movers`, `get_market_breadth`,
`get_market_mood`; reference `search_symbols`, `nse_lookup_symbol`, `get_corporate_actions`.
Full descriptions and input schemas: `GET /market/nse/tools`.

Tools used by this integration: the ones in the Routes table. The remaining tools were discovered but are not wired in.

## Behaviour verified against the live servers

* **Current quotes:** `cm_get_stock_quote` (stocks), `cm_get_index_quote` / `cm_get_live_indices` (indices). Timestamps are IST without an offset; the client attaches `+05:30`.
* **Historical data:** only Bhavcopy tools. Daily, end-of-day, one day behind at best. `get_stock_history` returns ≤3 months per call (chained via `next_end_date`).
* **Tool errors are not MCP errors.** A bad symbol returns `isError=false` with body `{"error": "..."}`; the client converts that to `NSEMCPToolError`.
* `get_ltp_by_date` silently returns the latest price for an invalid date (`"garbage"`), so it is deliberately **not used**.
* `get_stock_history` prices are **raw, not split/bonus adjusted**. The service calls `get_corporate_actions` for the window and flags/avoids using the data when an action with `adjustmentFactor != 1` (or SPLIT/BONUS) falls inside it.
* Servers answer `DELETE` (session termination) with 501; sessions are therefore opened per call and never terminated.
* **Reliability:** both servers intermittently stop responding (observed repeatedly, sometimes for minutes: `initialize`/`tools/list`/`tools/call` hang). Handled by a 10 s per-attempt timeout, up to 3 attempts, and a 45 s per-endpoint cooldown after a failed attempt. Callers can pass an absolute `deadline`: each attempt is capped by the time left, no attempt or backoff starts when the budget is spent, and budget exhaustion alone does not trigger a cooldown.

## Data validation

* Core values (`lastTradedPrice`, index `last`, history `close`) must be finite and > 0, otherwise the call fails (`502`) instead of returning a default.
* Optional values that are missing/0/NaN become `null` with a warning (e.g. 52-week range, previous close). Inverted day ranges are discarded.
* Returned symbol must equal the requested one.
* History: invalid rows are dropped and counted in `warnings`; rows are deduplicated and sorted.
* Freshness labels: `live` (≤6 min old in session), `delayed` (≤30 min), `stale`, `closed` (market closed, data ≤4 days old), `eod` (Bhavcopy, consistent with the previous trading weekday), `unknown` (missing/future/unparseable timestamp). Session hours are Mon–Fri 09:15–15:30 IST; **exchange holidays are not known**, so a holiday can yield a "lags" warning.

## Research Agent behaviour

For `.NS` tickers the agent fetches a live quote and 3 months of NSE history (one tool call) concurrently, against a shared total budget of `NSE_RESEARCH_BUDGET_SECONDS` (default 8 s). Requests not finished by the budget (+1 s grace) are abandoned and the Yahoo Finance fallback proceeds, so an NSE outage adds at most ~9 s instead of 30-60 s. In the service, the corporate-action lookup runs concurrently with the history call over a window at least as wide as the requested months; history that starts before that window is treated as unverified.
* NSE history is used for moving averages/RSI only if the corporate-action check succeeded and found no price-affecting event; otherwise it uses yfinance exactly as before.
* The live quote (only if `live`/`delayed`/`closed`) sets current price, change % and the 52-week range. If the quote is unavailable, the 52-week range is left empty rather than derived from a few months of bars.
* `ResearchReport` gains `market_data_source`, `market_data_as_of`, `market_data_freshness`, `market_data_warnings`; attribution lines are appended to `sources`.
* Non-NSE symbols (`.BO`, US tickers) never touch NSE. Any NSE failure is logged and swallowed; the yfinance path is unchanged.

## Configuration (all optional)

| Env var | Default |
|---|---|
| `NSE_MCP_ENABLED` | `true` (`false` disables all NSE calls) |
| `NSE_MCP_CM_URL`, `NSE_MCP_BHAVCOPY_URL` | the URLs above |
| `NSE_MCP_TIMEOUT_SECONDS` | `10` |
| `NSE_MCP_ATTEMPTS` | `3` |
| `NSE_MCP_COOLDOWN_SECONDS` | `45` |
| `NSE_RESEARCH_BUDGET_SECONDS` | `8` (Research Agent enrichment cap) |

## Usage restrictions and limitations

* NSE's tool descriptions state the data is for **informational and educational purposes only**, not investment advice. This project is an academic prototype; **commercial use, redistribution, or use of this data to train AI models is not assumed to be permitted**. NSE's full terms were not reviewed here; check them before any such use. Responses are cached (quotes 30 s, history 15 min) and calls are capped at 4 concurrent to limit load.
* Live data is only as fresh as NSE's cache (quotes ~1 min, gainers/losers ~5 min).
* Historical data is end-of-day only (no intraday history tool was found).
* Prices are unadjusted; `get_corporate_actions` may fail, in which case the history is returned with an explicit warning.
* BSE (`.BO`) symbols are not served by these endpoints.
* An unknown symbol returns a clean `{"error": "Symbol 'X' not found"}` when the server is responsive (verified for `cm_get_stock_quote` and `get_stock_history`), but during an unresponsive spell the same request times out, so a `504`/`502` does not prove the symbol is valid or invalid.
