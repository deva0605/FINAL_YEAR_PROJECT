/**
 * StockPriceChart — interactive OHLCV chart via TradingView Lightweight Charts v5.
 *
 * Bug fixes vs previous version:
 * - Chart is created ONCE on mount and NEVER recreated.  `hasVolume` is no
 *   longer a dependency of the chart-creation effect, so switching chart types
 *   (area ↔ candle) or range cannot trigger a chart tear-down / rebuild cycle.
 * - All series-manipulation calls are wrapped in try/catch so a Lightweight
 *   Charts internal error can never bubble up and crash the React tree (white
 *   screen of death).
 * - Volume price-scale is configured inside the series effect, not during chart
 *   creation, so it always matches the current data.
 * - priceSeriesRef / volSeriesRef / maSeriesRefs are set to null inside the
 *   series cleanup so a subsequent effect never operates on a stale reference.
 *
 * Attribution: TradingView Lightweight Charts™ (Apache 2.0)
 * https://tradingview.github.io/lightweight-charts/
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  LineStyle,
  AreaSeries,
  LineSeries,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type CandlestickData,
  type AreaData,
  type LineData,
  type Time,
  type HistogramData,
} from 'lightweight-charts';
import { cn } from '../../utils/cn';
import { SectionCard } from '../common/SectionCard';
import { availableRanges, useChartData, type RangeKey } from '../../hooks/useChartData';
import { OhlcBar } from '../../types';
import { formatMoney } from '../../utils/currency';

// ---- design tokens -------------------------------------------------------
const T = {
  ink:         '#0f172a',
  inkMuted:    '#64748b',
  line:        '#e2e8f0',
  lineStrong:  '#cbd5e1',
  canvas:      '#f8fafc',
  accent:      '#059669',
  danger:      '#dc2626',
  ma20:        '#3b82f6',
  ma50:        '#f97316',
  volume:      '#e2e8f0',
};

// ---- props ---------------------------------------------------------------
interface StockPriceChartProps {
  symbol: string;
  company?: string;
  latestPrice?: number | null;
  currency?: string | null;
  id?: string;
}

// ---- helpers -------------------------------------------------------------
type ChartType = 'area' | 'candle';
const RANGE_LABELS: RangeKey[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];

const toTime = (d: string): Time => d as Time;

function toCandles(bars: OhlcBar[]): CandlestickData[] {
  return bars
    .filter((b) => b.open != null && b.high != null && b.low != null)
    .map((b) => ({
      time: toTime(b.date),
      open: b.open!,
      high: b.high!,
      low: b.low!,
      close: b.close,
    }));
}

function toArea(bars: OhlcBar[]): AreaData[] {
  return bars.map((b) => ({ time: toTime(b.date), value: b.close }));
}

function toVolume(bars: OhlcBar[]): HistogramData[] {
  return bars
    .filter((b) => b.volume != null && b.volume > 0)
    .map((b) => ({ time: toTime(b.date), value: b.volume!, color: T.volume }));
}

function toLine(pts: { date: string; value: number }[]): LineData[] {
  return pts.map((p) => ({ time: toTime(p.date), value: p.value }));
}

function fmtVol(v: number): string {
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

// Safe removeSeries: never throws regardless of chart / series state.
function safeRemove(chart: IChartApi | null, s: ISeriesApi<SeriesType> | null) {
  if (!chart || !s) return;
  try { chart.removeSeries(s); } catch { /* series already gone */ }
}

// ---- floating tooltip ---------------------------------------------------
interface Tip {
  date: string; open?: number; high?: number; low?: number;
  close?: number; volume?: number; x: number; y: number;
  visible: boolean; cw: number;
}
const EMPTY_TIP: Tip = { date: '', x: 0, y: 0, visible: false, cw: 800 };

const Tooltip: React.FC<{ tip: Tip; currency?: string | null }> = ({ tip, currency }) => {
  if (!tip.visible) return null;
  const fmt = (v?: number) => (v != null ? formatMoney(v, currency, 2) : '—');
  const flip = tip.x > tip.cw * 0.65;
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-line bg-white px-3 py-2 shadow-pop text-xs whitespace-nowrap"
      style={{
        left:  flip ? undefined : tip.x + 14,
        right: flip ? tip.cw - tip.x + 14 : undefined,
        top:   Math.max(0, tip.y - 10),
      }}
    >
      <div className="mb-1.5 font-semibold text-ink">{tip.date}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums text-ink-soft">
        {tip.open  != null && <><span className="text-ink-muted">O</span><span>{fmt(tip.open)}</span></>}
        {tip.high  != null && <><span className="text-ink-muted">H</span><span>{fmt(tip.high)}</span></>}
        {tip.low   != null && <><span className="text-ink-muted">L</span><span>{fmt(tip.low)}</span></>}
        <span className="text-ink-muted">C</span>
        <span className="font-semibold text-ink">{fmt(tip.close)}</span>
        {tip.volume != null && tip.volume > 0 && (
          <><span className="text-ink-muted">Vol</span><span>{fmtVol(tip.volume)}</span></>
        )}
      </div>
    </div>
  );
};

// ---- main component -------------------------------------------------------
export const StockPriceChart: React.FC<StockPriceChartProps> = ({
  symbol, company, latestPrice, currency, id = 'price-chart',
}) => {
  const { state, range, setRange } = useChartData(symbol);
  const [chartType, setChartType] = useState<ChartType>('area');
  const [showMa20, setShowMa20] = useState(true);
  const [showMa50, setShowMa50] = useState(true);
  const [tip, setTip] = useState<Tip>(EMPTY_TIP);

  const containerRef = useRef<HTMLDivElement>(null);

  // These refs track the live chart instance and its series.
  // They are NEVER set to anything from an already-removed chart.
  const chartRef  = useRef<IChartApi | null>(null);
  const priceRef  = useRef<ISeriesApi<SeriesType> | null>(null);
  const volRef    = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma20Ref   = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50Ref   = useRef<ISeriesApi<'Line'> | null>(null);

  const available = availableRanges(state.data?.bars ?? []);

  // ---- create chart once on mount ---------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let chart: IChartApi;
    try {
      chart = createChart(el, {
        layout: {
          background: { color: '#ffffff' },
          textColor: T.inkMuted,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: T.line, style: LineStyle.Dotted },
          horzLines: { color: T.line, style: LineStyle.Dotted },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: T.lineStrong, style: LineStyle.Dashed, width: 1 },
          horzLine: { color: T.lineStrong, style: LineStyle.Dashed, width: 1 },
        },
        rightPriceScale: {
          borderColor: T.line,
          // Leave bottom margin to accommodate volume; we set it on the volume
          // scale later — but we always reserve the slot to avoid layout jumps.
          scaleMargins: { top: 0.08, bottom: 0.25 },
        },
        timeScale: {
          borderColor: T.line,
          timeVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
        handleScale: { mouseWheel: true, pinch: true },
        width: el.clientWidth,
        height: 340,
      });
    } catch (e) {
      console.error('[StockPriceChart] createChart failed:', e);
      return;
    }

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      try { chart.applyOptions({ width: el.clientWidth }); } catch {}
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      // Null all series refs BEFORE removing chart so the series effect's
      // safeRemove() won't try to call removeSeries on an already-dead chart.
      priceRef.current = null;
      volRef.current   = null;
      ma20Ref.current  = null;
      ma50Ref.current  = null;
      try { chart.remove(); } catch {}
      chartRef.current = null;
    };
  }, []); // ← intentionally empty: chart lives for the component's lifetime

  // ---- sync series data whenever data / chart-type / MA toggles change --
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || state.status !== 'success' || state.visibleBars.length === 0) return;

    // Remove every existing series before adding new ones.
    safeRemove(chart, priceRef.current);  priceRef.current = null;
    safeRemove(chart, volRef.current);    volRef.current   = null;
    safeRemove(chart, ma20Ref.current);   ma20Ref.current  = null;
    safeRemove(chart, ma50Ref.current);   ma50Ref.current  = null;

    const bars = state.visibleBars;

    try {
      // ---- price series ------------------------------------------------
      if (chartType === 'candle') {
        const candleBars = toCandles(bars);
        if (candleBars.length > 0) {
          const cs = chart.addSeries(CandlestickSeries, {
            upColor:        T.accent,
            downColor:      T.danger,
            borderUpColor:  T.accent,
            borderDownColor:T.danger,
            wickUpColor:    T.accent,
            wickDownColor:  T.danger,
          });
          cs.setData(candleBars);
          priceRef.current = cs;
        }
      } else {
        const as_ = chart.addSeries(AreaSeries, {
          lineColor:                     T.accent,
          topColor:                      `${T.accent}28`,
          bottomColor:                   `${T.accent}00`,
          lineWidth:                     2,
          crosshairMarkerVisible:        true,
          crosshairMarkerRadius:         4,
          crosshairMarkerBackgroundColor:T.accent,
        });
        as_.setData(toArea(bars));
        priceRef.current = as_;
      }

      // ---- volume panel ------------------------------------------------
      const volBars = toVolume(bars);
      if (volBars.length > 0) {
        const vs = chart.addSeries(HistogramSeries, {
          priceScaleId: 'volume',
          priceFormat: { type: 'volume' },
        });
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
          borderColor: T.line,
        });
        vs.setData(volBars);
        volRef.current = vs as ISeriesApi<'Histogram'>;
      }

      // ---- MA overlays -------------------------------------------------
      if (showMa20 && state.ma20.length > 0) {
        const m = chart.addSeries(LineSeries, {
          color: T.ma20, lineWidth: 1, lineStyle: LineStyle.Solid,
          title: 'MA 20', lastValueVisible: false, priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        m.setData(toLine(state.ma20));
        ma20Ref.current = m as ISeriesApi<'Line'>;
      }
      if (showMa50 && state.ma50.length > 0) {
        const m = chart.addSeries(LineSeries, {
          color: T.ma50, lineWidth: 1, lineStyle: LineStyle.Solid,
          title: 'MA 50', lastValueVisible: false, priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        m.setData(toLine(state.ma50));
        ma50Ref.current = m as ISeriesApi<'Line'>;
      }

      chart.timeScale().fitContent();

    } catch (e) {
      console.error('[StockPriceChart] series update error:', e);
      // Don't rethrow — a chart render error must never crash the React tree.
    }

    // ---- crosshair tooltip -------------------------------------------
    const handler = (
      param: Parameters<Parameters<typeof chart.subscribeCrosshairMove>[0]>[0],
    ) => {
      const el = containerRef.current;
      if (!el || !param.point || param.point.x < 0 || !param.time) {
        setTip((t) => ({ ...t, visible: false }));
        return;
      }
      const ps = priceRef.current;
      if (!ps) return;
      const raw = param.seriesData.get(ps);
      if (!raw) return;

      const dateStr = String(param.time);
      const bar = bars.find((b) => b.date === dateStr);
      const volD = volRef.current
        ? (param.seriesData.get(volRef.current) as HistogramData | undefined)
        : undefined;

      setTip({
        date:   dateStr,
        open:   bar?.open   ?? undefined,
        high:   bar?.high   ?? undefined,
        low:    bar?.low    ?? undefined,
        close:  bar?.close  ?? (raw as AreaData).value ?? undefined,
        volume: volD?.value ?? bar?.volume ?? undefined,
        x: param.point.x,
        y: param.point.y,
        visible: true,
        cw: el.clientWidth,
      });
    };

    chart.subscribeCrosshairMove(handler);
    return () => {
      try { chart.unsubscribeCrosshairMove(handler); } catch {}
    };
  }, [state, chartType, showMa20, showMa50]);
  // ↑ Note: hasVolume is NOT a dependency — volume is handled inside this
  //   effect so the chart is never recreated when volume availability changes.

  // ---- render ----------------------------------------------------------
  const { status, data, error } = state;

  const controls = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Area / Candles toggle */}
      <div className="flex rounded-lg border border-line overflow-hidden text-xs">
        {(['area', 'candle'] as ChartType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setChartType(t)}
            className={cn(
              'px-2.5 py-1 font-medium capitalize transition-colors',
              chartType === t
                ? 'bg-ink text-white'
                : 'bg-white text-ink-muted hover:bg-canvas hover:text-ink',
            )}
          >
            {t === 'area' ? 'Area' : 'Candles'}
          </button>
        ))}
      </div>
      {/* MA toggles */}
      <button
        type="button"
        onClick={() => setShowMa20((v) => !v)}
        className={cn(
          'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
          showMa20
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-line bg-white text-ink-muted hover:bg-canvas',
        )}
      >MA 20</button>
      <button
        type="button"
        onClick={() => setShowMa50((v) => !v)}
        className={cn(
          'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
          showMa50
            ? 'border-orange-300 bg-orange-50 text-orange-700'
            : 'border-line bg-white text-ink-muted hover:bg-canvas',
        )}
      >MA 50</button>
    </div>
  );

  const badge = data
    ? `${data.exchange ?? data.source.split(' ')[0]} · ${data.price_adjusted ? 'adj.' : 'unadjusted'}`
    : undefined;

  return (
    <SectionCard
      id={id}
      title={`Price chart${company ? ` — ${company}` : ''}`}
      description={
        latestPrice != null
          ? `Latest: ${formatMoney(latestPrice, currency)} ${(currency ?? '').toUpperCase()}`.trim()
          : 'Interactive historical price chart'
      }
      badge={badge}
      actions={controls}
    >
      {/* Range selector row */}
      <div className="mb-3 flex flex-wrap gap-1">
        {RANGE_LABELS.map((r) => {
          const enabled = available.includes(r);
          return (
            <button
              key={r}
              type="button"
              disabled={!enabled || status === 'loading'}
              onClick={() => setRange(r)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                range === r && enabled
                  ? 'bg-ink text-white'
                  : enabled
                  ? 'bg-canvas text-ink-muted hover:bg-slate-100 hover:text-ink'
                  : 'cursor-not-allowed text-ink-faint',
              )}
            >
              {r}
            </button>
          );
        })}
      </div>

      {/* Chart container */}
      <div className="relative">
        {/* Loading overlay — sits ON TOP of chart, chart canvas stays mounted */}
        {status === 'loading' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80">
            <div className="flex flex-col items-center gap-2 text-ink-muted">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs">Loading chart…</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-canvas">
            <div className="text-center px-4">
              <p className="text-sm font-medium text-danger">Chart data unavailable</p>
              <p className="mt-1 text-xs text-ink-muted">{error}</p>
            </div>
          </div>
        )}

        {/* Empty range */}
        {status === 'success' && state.visibleBars.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-canvas">
            <p className="text-sm text-ink-muted">No price data for the selected range.</p>
          </div>
        )}

        {/* The Lightweight Charts canvas — always in DOM so chartRef attaches */}
        <div ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ height: 340 }} />

        <Tooltip tip={tip} currency={currency} />
      </div>

      {/* Footer */}
      {data && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-ink-muted">
            Source: {data.source}
            {data.from_date && data.to_date ? ` · ${data.from_date} – ${data.to_date}` : ''}
          </p>
          {data.warnings.slice(0, 2).map((w, i) => (
            <p key={i} className="text-xs text-caution">⚠ {w}</p>
          ))}
          <p className="text-xs text-ink-faint">
            Powered by{' '}
            <a href="https://tradingview.github.io/lightweight-charts/" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink-muted">
              TradingView Lightweight Charts™
            </a>
          </p>
        </div>
      )}
    </SectionCard>
  );
};
