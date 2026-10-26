import React from 'react';
import { ResearchReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { DataMetric } from '../common/DataMetric';
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

  return (
    <SectionCard title="Market Snapshot" badge="Real-time">
      <div className="grid grid-cols-2 gap-3">
        <DataMetric label="52-Week High" value={high52 != null ? formatMoney(high52, r?.currency) : undefined} />
        <DataMetric label="52-Week Low" value={low52 != null ? formatMoney(low52, r?.currency) : undefined} />
        <DataMetric label="20d Moving Avg" value={ma20 != null ? formatMoney(ma20, r?.currency) : undefined} />
        <DataMetric label="50d Moving Avg" value={ma50 != null ? formatMoney(ma50, r?.currency) : undefined} />
        <DataMetric label="RSI (14)" value={rsi != null ? rsi.toFixed(1) : undefined} sub={rsi != null ? (rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral') : undefined} />
        <DataMetric label="Dividend Yield" value={r?.fundamentals?.dividend_yield != null ? fmtPct(r?.fundamentals?.dividend_yield) : undefined} />
      </div>
    </SectionCard>
  );
};
