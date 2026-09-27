import React from 'react';
import { RiskReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { RiskBadge } from '../common/Badges';

interface RiskPanelProps {
  report?: RiskReport;
}

function RiskRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-600 font-medium">{label}</span>
      <RiskBadge risk={value} />
    </div>
  );
}

export const RiskPanel: React.FC<RiskPanelProps> = ({ report }) => {
  if (!report) return null;

  return (
    <SectionCard title="Risk Agent" badge="Models">
      <div className="flex flex-col gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Risk Matrix</div>
          <RiskRow label="Volatility" value={report.volatility} />
          <RiskRow label="Liquidity" value={report.liquidity} />
          <RiskRow label="Valuation Risk" value={report.valuation} />
          <RiskRow label="Financial Risk" value={report.financial_risk} />
          <RiskRow label="News Risk" value={report.news_risk} />
          <RiskRow label="Macro Risk" value={report.macro_risk} />
        </div>

        {report.risk_score != null && (
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Total Risk Score</div>
              <div className="text-xs text-slate-400">Aggregate multi-factor rating</div>
            </div>
            <div className="text-2xl font-black font-mono text-slate-900">
              {report.risk_score.toFixed(0)}<span className="text-sm font-normal text-slate-400">/100</span>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
};
