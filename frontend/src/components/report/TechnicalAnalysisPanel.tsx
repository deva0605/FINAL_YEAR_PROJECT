import React from 'react';
import { ResearchReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { SentimentBadge } from '../common/Badges';
import { cn } from '../../utils/cn';

interface TechnicalAnalysisPanelProps {
  report?: ResearchReport;
}

function RsiGauge({ rsi }: { rsi?: number | null }) {
  if (rsi == null) return null;
  const pct = Math.min(Math.max(rsi, 0), 100);
  const color = rsi < 30 ? 'text-secondary' : rsi > 70 ? 'text-error' : 'text-tertiary';
  const label = rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral';

  return (
    <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
      <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">RSI (14)</div>
      <div className={cn('text-2xl font-black', color)}>{rsi.toFixed(1)}</div>
      <div className="mt-2 h-2 bg-surface-container rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', rsi < 30 ? 'bg-secondary' : rsi > 70 ? 'bg-error' : 'bg-tertiary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-label-sm text-on-surface-variant">{label}</div>
    </div>
  );
}

interface MaTrendProps {
  price?: number | null;
  ma20?: number | null;
  ma50?: number | null;
}

function MaTrend({ price, ma20, ma50 }: MaTrendProps) {
  if (!price) return null;
  const bullish = price > (ma20 || 0) && price > (ma50 || 0);
  const bearish = price < (ma20 || Infinity) && price < (ma50 || Infinity);
  const trend = bullish ? 'Bullish' : bearish ? 'Bearish' : 'Neutral';
  const icon = bullish ? 'trending_up' : bearish ? 'trending_down' : 'trending_flat';
  const color = bullish ? 'text-secondary' : bearish ? 'text-error' : 'text-tertiary';

  return (
    <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
      <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">MA Trend</div>
      <div className={cn('flex items-center gap-2 text-title-lg font-bold', color)}>
        <span className="material-symbols-outlined">{icon}</span>
        {trend}
      </div>
      {ma20 && <div className="text-label-sm text-on-surface-variant mt-1">20d: ${ma20.toFixed(2)}</div>}
      {ma50 && <div className="text-label-sm text-on-surface-variant">50d: ${ma50.toFixed(2)}</div>}
    </div>
  );
}

export const TechnicalAnalysisPanel: React.FC<TechnicalAnalysisPanelProps> = ({ report }) => {
  const r = report;
  const ti = r?.technical_indicators;
  const ma = r?.moving_averages;

  const price = r?.current_price ?? ti?.latest_close;
  const rsi = r?.rsi ?? ti?.rsi_14;
  const ma20 = ma?.['20d'] ?? ti?.moving_average_20;
  const ma50 = ma?.['50d'] ?? ti?.moving_average_50;
  const high52 = r?.high_52_week ?? ti?.high_52_week;
  const low52 = r?.low_52_week ?? ti?.low_52_week;

  const positionPct = (price && high52 && low52 && (high52 - low52) > 0)
    ? ((price - low52) / (high52 - low52)) * 100 : null;

  return (
    <SectionCard title="Technical Analysis" icon="show_chart" accent="secondary">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <RsiGauge rsi={rsi} />
        <MaTrend price={price} ma20={ma20} ma50={ma50} />

        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Sentiment</div>
          <SentimentBadge sentiment={r?.sentiment} />
        </div>

        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">52-Week Position</div>
          {positionPct != null ? (
            <>
              <div className="text-title-md font-bold text-on-surface">{positionPct.toFixed(0)}%</div>
              <div className="mt-2 h-2 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${positionPct}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-label-xs text-on-surface-variant">
                <span>${low52?.toFixed(0)}</span>
                <span>${high52?.toFixed(0)}</span>
              </div>
            </>
          ) : <span className="text-on-surface-variant">—</span>}
        </div>
      </div>

      {r?.technical_summary && (
        <div className="mt-4 p-4 bg-surface-container rounded-xl border-l-4 border-secondary/30">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Technical Summary</div>
          <p className="text-body-md text-on-surface leading-relaxed">{r.technical_summary}</p>
        </div>
      )}
    </SectionCard>
  );
};
