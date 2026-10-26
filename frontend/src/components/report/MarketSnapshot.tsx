import React from 'react';
import { ResearchReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { DataMetric, MetricGrid } from '../common/DataMetric';
import { Disclosure } from '../common/Disclosure';
import { formatMoney } from '../../utils/currency';

function fmtPct(val?: number | null): string {
  if (val == null) return '—';
  return `${(val * 100).toFixed(2)}%`;
}

interface MarketSnapshotProps {
  report?: ResearchReport;
}

export const MarketSnapshot: React.FC<MarketSnapshotProps> = ({ report }) => {
  const r = report;
  const ma = r?.moving_averages;
  const ti = r?.technical_indicators;

  const high52 = r?.high_52_week ?? ti?.high_52_week;
  const low52 = r?.low_52_week ?? ti?.low_52_week;
  const rsi = r?.rsi ?? ti?.rsi_14;
  const ma20 = ma?.['20d'] ?? ti?.moving_average_20;
  const ma50 = ma?.['50d'] ?? ti?.moving_average_50;
  const notes = r?.market_data_warnings || [];

  return (
    <SectionCard
      id="market"
      title="Market snapshot"
      badge={r?.market_data_freshness ? `Data: ${r.market_data_freshness}` : undefined}
      description="Price levels and momentum from the latest market data."
    >
      <MetricGrid className="grid-cols-2 sm:grid-cols-3">
        <DataMetric label="52-week high" value={high52 != null ? formatMoney(high52, r?.currency) : undefined} />
        <DataMetric label="52-week low" value={low52 != null ? formatMoney(low52, r?.currency) : undefined} />
        <DataMetric label="RSI (14)" value={rsi != null ? rsi.toFixed(1) : undefined} sub={rsi != null ? (rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral') : undefined} />
        <DataMetric label="20-day average" value={ma20 != null ? formatMoney(ma20, r?.currency) : undefined} />
        <DataMetric label="50-day average" value={ma50 != null ? formatMoney(ma50, r?.currency) : undefined} />
        <DataMetric label="Dividend yield" value={r?.fundamentals?.dividend_yield != null ? fmtPct(r?.fundamentals?.dividend_yield) : undefined} />
      </MetricGrid>

      {(notes.length > 0 || r?.market_data_source) && (
        <Disclosure label="Data notes" count={notes.length} className="mt-4">
          {r?.market_data_source && <p className="mb-2 text-xs text-ink-muted">Source: {r.market_data_source}</p>}
          {notes.length > 0 ? (
            <ul className="space-y-1.5">
              {notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-ink-soft">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-caution" aria-hidden="true" />
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-muted">No data warnings were raised.</p>
          )}
        </Disclosure>
      )}
    </SectionCard>
  );
};
