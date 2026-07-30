import React from 'react';
import { ResearchReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { DataMetric } from '../common/DataMetric';

function fmtMoney(val?: number | null, decimals = 2): string {
  if (val == null) return '—';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toFixed(decimals)}`;
}

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

  const price = r?.current_price ?? ti?.latest_close;
  const high52 = r?.high_52_week ?? ti?.high_52_week;
  const low52 = r?.low_52_week ?? ti?.low_52_week;
  const rsi = r?.rsi ?? ti?.rsi_14;
  const peRatio = r?.pe_ratio ?? r?.fundamentals?.pe_ratio;
  const marketCap = r?.market_cap ?? r?.fundamentals?.market_cap;
  const divYield = r?.fundamentals?.dividend_yield;
  const beta = r?.fundamentals?.beta;
  const ma20 = ma?.['20d'] ?? ti?.moving_average_20;
  const ma50 = ma?.['50d'] ?? ti?.moving_average_50;
  const chg = ti?.change_percent;

  return (
    <SectionCard title="Market Snapshot" icon="candlestick_chart" accent="primary">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <DataMetric label="Current Price" value={price != null ? `$${price.toFixed(2)}${chg != null ? ` (${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%)` : ''}` : undefined} highlight />
        <DataMetric label="Market Cap" value={fmtMoney(marketCap)} />
        <DataMetric label="P/E Ratio" value={peRatio != null ? peRatio.toFixed(1) : undefined} />
        <DataMetric label="EPS" value={r?.eps != null ? `$${r.eps.toFixed(2)}` : undefined} />
        <DataMetric label="Revenue" value={fmtMoney(r?.revenue)} />
        <DataMetric label="52-Week High" value={high52 != null ? `$${high52.toFixed(2)}` : undefined} />
        <DataMetric label="52-Week Low" value={low52 != null ? `$${low52.toFixed(2)}` : undefined} />
        <DataMetric label="Dividend Yield" value={divYield != null ? fmtPct(divYield) : undefined} />
        <DataMetric label="20d Moving Avg" value={ma20 != null ? `$${ma20.toFixed(2)}` : undefined} />
        <DataMetric label="50d Moving Avg" value={ma50 != null ? `$${ma50.toFixed(2)}` : undefined} />
        <DataMetric label="RSI (14)" value={rsi != null ? rsi.toFixed(1) : undefined} sub={rsi != null ? (rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral') : undefined} />
        <DataMetric label="Beta" value={beta != null ? beta.toFixed(2) : undefined} />
      </div>
    </SectionCard>
  );
};
