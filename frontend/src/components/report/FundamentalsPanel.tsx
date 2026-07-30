import React from 'react';
import { ResearchReport, StrategyReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { DataMetric } from '../common/DataMetric';

interface FundamentalsPanelProps {
  report?: ResearchReport;
  strategy?: StrategyReport;
}

export const FundamentalsPanel: React.FC<FundamentalsPanelProps> = ({ report, strategy }) => {
  const r = report;
  const fund = r?.fundamentals;
  const peRatio = r?.pe_ratio ?? fund?.pe_ratio;
  const marketCap = r?.market_cap ?? fund?.market_cap;
  const divYield = fund?.dividend_yield;
  const pb = fund?.price_to_book;
  const beta = fund?.beta;
  const summary = r?.fundamental_summary || fund?.long_business_summary;

  function marketCapTier(cap?: number | null) {
    if (!cap) return '—';
    if (cap >= 200e9) return 'Mega-Cap';
    if (cap >= 10e9) return 'Large-Cap';
    if (cap >= 2e9) return 'Mid-Cap';
    return 'Small-Cap';
  }

  function valuationLabel(pe?: number | null) {
    if (pe == null) return '—';
    if (pe < 0) return 'Loss-Making';
    if (pe < 15) return 'Undervalued';
    if (pe < 30) return 'Fair Value';
    if (pe < 50) return 'Stretched';
    return 'Overvalued';
  }

  return (
    <SectionCard title="Fundamental Analysis" icon="account_balance" accent="tertiary">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <DataMetric label="Market Cap" value={marketCap != null ? (marketCap >= 1e9 ? `$${(marketCap / 1e9).toFixed(1)}B` : `$${(marketCap / 1e6).toFixed(0)}M`) : undefined} sub={marketCapTier(marketCap)} />
        <DataMetric label="P/E Ratio" value={peRatio?.toFixed(1)} sub={valuationLabel(peRatio)} />
        <DataMetric label="Price to Book" value={pb?.toFixed(2)} />
        <DataMetric label="Dividend Yield" value={divYield != null ? `${(divYield * 100).toFixed(2)}%` : undefined} />
        <DataMetric label="Beta" value={beta?.toFixed(2)} sub={beta != null ? (beta > 1.5 ? 'High Volatility' : beta < 0.5 ? 'Defensive' : 'Moderate') : undefined} />
        <DataMetric label="EPS" value={r?.eps != null ? `$${r.eps.toFixed(2)}` : undefined} />
      </div>

      {summary && (
        <div className="p-4 bg-surface-container rounded-xl border-l-4 border-tertiary/30">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Fundamental Summary</div>
          <p className="text-body-md text-on-surface leading-relaxed">{summary}</p>
        </div>
      )}

      {fund?.website && (
        <div className="mt-3">
          <a href={fund.website} target="_blank" rel="noreferrer" className="text-primary text-label-md hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            {fund.website}
          </a>
        </div>
      )}
    </SectionCard>
  );
};
