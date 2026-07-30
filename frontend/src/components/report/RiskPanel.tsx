import React from 'react';
import { RiskReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { RiskBadge } from '../common/Badges';
import { cn } from '../../utils/cn';

interface RiskPanelProps {
  report?: RiskReport;
}

function RiskRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-outline-variant/10">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      <RiskBadge risk={value} />
    </div>
  );
}

export const RiskPanel: React.FC<RiskPanelProps> = ({ report }) => {
  if (!report) return null;

  const riskScore = report.risk_score;

  return (
    <SectionCard title="Risk Agent" icon="shield" accent="error">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Risk Metrics</div>
          <RiskRow label="Volatility" value={report.volatility} />
          <RiskRow label="Liquidity" value={report.liquidity} />
          <RiskRow label="Valuation Risk" value={report.valuation} />
          <RiskRow label="Financial Risk" value={report.financial_risk} />
          <RiskRow label="News Risk" value={report.news_risk} />
          <RiskRow label="Macro Risk" value={report.macro_risk} />

          {riskScore != null && (
            <div className="mt-4 p-4 bg-surface-container rounded-xl border border-outline-variant/10">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Risk Score</div>
              <div className={cn('text-2xl font-black', riskScore > 60 ? 'text-error' : riskScore > 40 ? 'text-tertiary' : 'text-secondary')}>
                {riskScore.toFixed(0)}<span className="text-sm font-normal text-on-surface-variant">/100</span>
              </div>
              <div className="mt-2 h-2 bg-surface-container-low rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', riskScore > 60 ? 'bg-error' : riskScore > 40 ? 'bg-tertiary' : 'bg-secondary')}
                  style={{ width: `${riskScore}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div>
          {(report.weaknesses || []).length > 0 && (
            <div className="mb-4">
              <div className="text-label-sm text-error uppercase tracking-widest mb-2">Key Weaknesses</div>
              <ul className="space-y-2">
                {report.weaknesses!.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-body-md text-on-surface-variant">
                    <span className="material-symbols-outlined text-error text-[16px] mt-0.5 flex-shrink-0">warning</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(report.recommendations || []).length > 0 && (
            <div>
              <div className="text-label-sm text-secondary uppercase tracking-widest mb-2">Mitigation Suggestions</div>
              <ul className="space-y-2">
                {report.recommendations!.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-body-md text-on-surface-variant">
                    <span className="material-symbols-outlined text-secondary text-[16px] mt-0.5 flex-shrink-0">check_circle</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {(report.reasons || []).length > 0 && (
        <div className="mt-6 p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Risk Explanation</div>
          <ul className="space-y-1">
            {report.reasons!.slice(0, 6).map((r, i) => (
              <li key={i} className="text-body-md text-on-surface-variant">{r}</li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
};
