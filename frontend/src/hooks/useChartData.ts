/**
 * useChartData — fetch, cache, range-filter and compute MAs for the chart.
 *
 * Key design decisions:
 * - `dataRef` is a mutable ref that is ALWAYS up-to-date.  All effects read
 *   from it so there are no stale-closure bugs when range or symbol change.
 * - The cache is keyed by `{symbol}:{months}` so a 1Y fetch does not evict
 *   the earlier 3M fetch.
 * - MAs are computed here from the *visible* slice, so they are always aligned
 *   with the price series the chart shows.
 */
import { useEffect, useRef, useState } from 'react';
import { fetchChartHistory } from '../api/chart';
import { ChartHistoryResponse, OhlcBar } from '../types';

export type RangeKey = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL';

/** How many months of data to fetch for each range key. */
const FETCH_MONTHS: Record<RangeKey, number> = {
  '1D': 1,
  '1W': 1,
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '1Y': 13,
  '5Y': 61,
  'ALL': 61,
};

export interface MaSeries {
  date: string;
  value: number;
}

export interface ChartDataState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: ChartHistoryResponse | null;
  visibleBars: OhlcBar[];
  ma20: MaSeries[];
  ma50: MaSeries[];
  error: string | null;
}

// ---- pure helpers --------------------------------------------------------

function computeMa(bars: OhlcBar[], window: number): MaSeries[] {
  if (bars.length < window) return [];
  const out: MaSeries[] = [];
  for (let i = window - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += bars[j].close;
    out.push({ date: bars[i].date, value: +(sum / window).toFixed(4) });
  }
  return out;
}

function filterByRange(bars: OhlcBar[], range: RangeKey): OhlcBar[] {
  if (range === 'ALL' || bars.length === 0) return bars;
  const last = new Date(bars[bars.length - 1].date);
  const cutoff = new Date(last);
  switch (range) {
    case '1D': cutoff.setDate(cutoff.getDate() - 2);         break;
    case '1W': cutoff.setDate(cutoff.getDate() - 7);         break;
    case '1M': cutoff.setMonth(cutoff.getMonth() - 1);       break;
    case '3M': cutoff.setMonth(cutoff.getMonth() - 3);       break;
    case '6M': cutoff.setMonth(cutoff.getMonth() - 6);       break;
    case '1Y': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
    case '5Y': cutoff.setFullYear(cutoff.getFullYear() - 5); break;
  }
  const cutStr = cutoff.toISOString().slice(0, 10);
  return bars.filter((b) => b.date >= cutStr);
}

function derive(bars: OhlcBar[], range: RangeKey) {
  const visible = filterByRange(bars, range);
  return { visibleBars: visible, ma20: computeMa(visible, 20), ma50: computeMa(visible, 50) };
}

/** Returns only the range keys for which the full data covers the window. */
export function availableRanges(bars: OhlcBar[]): RangeKey[] {
  if (bars.length === 0) return [];
  const all: RangeKey[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];
  return all.filter((r) => filterByRange(bars, r).length > 0);
}

// ---- hook ----------------------------------------------------------------

export function useChartData(symbol: string | undefined) {
  const [range, setRange] = useState<RangeKey>('3M');
  const [state, setState] = useState<ChartDataState>({
    status: 'idle', data: null, visibleBars: [], ma20: [], ma50: [], error: null,
  });

  // Always-fresh ref to the current full response — used in effects to avoid
  // stale closures without adding `state` to effect dependency arrays.
  const dataRef = useRef<ChartHistoryResponse | null>(null);
  // Track which {symbol:months} combos we have already fetched.
  const cache = useRef<Map<string, ChartHistoryResponse>>(new Map());

  // ---- fetch when symbol changes -----------------------------------------
  useEffect(() => {
    if (!symbol) {
      dataRef.current = null;
      setState({ status: 'idle', data: null, visibleBars: [], ma20: [], ma50: [], error: null });
      return;
    }

    // Immediately clear stale data so the previous symbol's chart never shows.
    dataRef.current = null;
    setState({ status: 'loading', data: null, visibleBars: [], ma20: [], ma50: [], error: null });

    let cancelled = false;
    const months = FETCH_MONTHS[range] ?? 3;
    const cacheKey = `${symbol}:${months}`;

    const run = async () => {
      let data = cache.current.get(cacheKey) ?? null;
      if (!data) {
        data = await fetchChartHistory(symbol, months);
        if (!cancelled) cache.current.set(cacheKey, data);
      }
      if (cancelled) return;
      dataRef.current = data;
      const derived = derive(data.bars, range);
      setState({ status: 'success', data, error: null, ...derived });
    };

    run().catch((err: Error) => {
      if (cancelled) return;
      setState({ status: 'error', data: null, visibleBars: [], ma20: [], ma50: [], error: err.message });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // ---- re-slice on range change (no network call unless we need more data) -
  useEffect(() => {
    // dataRef.current is ALWAYS the latest data — no stale closure.
    const data = dataRef.current;
    if (!data || !symbol) return;

    const months = FETCH_MONTHS[range] ?? 3;
    const cacheKey = `${symbol}:${months}`;

    // Check if our current data covers the requested range.
    const hasEnough = filterByRange(data.bars, range).length > 0;

    if (hasEnough) {
      // Fast path — just re-slice what we have.
      const derived = derive(data.bars, range);
      setState((prev) => ({ ...prev, ...derived }));
      return;
    }

    // Slow path — need to fetch more history.
    setState((prev) => ({ ...prev, status: 'loading' }));
    let cancelled = false;

    const run = async () => {
      let newData = cache.current.get(cacheKey) ?? null;
      if (!newData) {
        newData = await fetchChartHistory(symbol, months);
        if (!cancelled) cache.current.set(cacheKey, newData);
      }
      if (cancelled) return;
      dataRef.current = newData;
      const derived = derive(newData.bars, range);
      setState({ status: 'success', data: newData, error: null, ...derived });
    };

    run().catch((err: Error) => {
      if (cancelled) return;
      // On error keep existing data but report the problem.
      setState((prev) => ({ ...prev, status: 'error', error: err.message }));
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return { state, range, setRange };
}
