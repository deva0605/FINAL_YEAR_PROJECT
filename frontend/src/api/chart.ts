import fetchWrapper from './client';
import { ChartHistoryResponse } from '../types';

/**
 * Fetch daily OHLCV history for a ticker.
 * Tries NSE MCP first (for .NS symbols, ≤12 months), then falls back to Yahoo Finance.
 *
 * @param symbol  - Ticker, e.g. "RELIANCE.NS", "TCS.NS", "AAPL"
 * @param months  - Calendar months of history (1–60)
 */
export async function fetchChartHistory(
  symbol: string,
  months: number,
): Promise<ChartHistoryResponse> {
  const safeMonths = Math.max(1, Math.min(60, Math.round(months)));
  return fetchWrapper<ChartHistoryResponse>(
    `/market/history/${encodeURIComponent(symbol)}?months=${safeMonths}`,
  );
}
