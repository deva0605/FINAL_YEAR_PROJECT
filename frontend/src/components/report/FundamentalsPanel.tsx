import React from 'react';
import { ResearchReport, StrategyReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { DataMetric } from '../common/DataMetric';

interface FundamentalsPanelProps {
  report?: ResearchReport;
  strategy?: StrategyReport;
}

export const FundamentalsPanel: React.FC<FundamentalsPanelProps> = ({ report }) => {
  const r = report;
  const fund = r?.fundamentals;
  const peRatio = r?.pe_ratio ?? fund?.pe_ratio;
  const marketCap = r?.market_cap ?? fund?.market_cap;
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
    <SectionCard title="Fundamental Analysis" badge="Valuation">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <DataMetric label="Market Cap" value={marketCap != null ? (marketCap >= 1e9 ? `$${(marketCap / 1e9).toFixed(1)}B` : `$${(marketCap / 1e6).toFixed(0)}M`) : undefined} sub={marketCapTier(marketCap)} />
        <DataMetric label="P/E Ratio" value={peRatio?.toFixed(1)} sub={valuationLabel(peRatio)} />
        <DataMetric label="Price to Book" value={pb?.toFixed(2)} />
        <DataMetric label="Beta" value={beta?.toFixed(2)} sub={beta != null ? (beta > 1.5 ? 'High Volatility' : beta < 0.5 ? 'Defensive' : 'Moderate') : undefined} />
      </div>

      {summary && (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Fundamental Summary</div>
          <p className="text-xs text-slate-700 leading-relaxed">{summary}</p>
        </div>
      )}

      {fund?.website && (
        <div className="mt-4 flex justify-end">
          <a href={fund.website} target="_blank" rel="noreferrer" className="text-xs font-mono text-slate-500 hover:text-slate-900 transition flex items-center gap-1.5">
            <span>Corporate Website</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></svg>
          </a>
        </div>
      )}
    </SectionCard>
  );
};
