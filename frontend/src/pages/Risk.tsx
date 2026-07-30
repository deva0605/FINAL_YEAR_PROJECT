import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { cn } from '../utils/cn';

export const Risk: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.risk_report;

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">warning</span>
        <h2 className="text-headline-sm font-bold">No Risk Assessment Data</h2>
        <p>Run an analysis from the dashboard to generate a risk profile.</p>
      </div>
    );
  }

  const getRiskColor = (rating: string) => {
    const r = rating?.toLowerCase() || '';
    if (r.includes('high')) return 'bg-error text-on-error';
    if (r.includes('medium')) return 'bg-tertiary text-on-tertiary';
    if (r.includes('low')) return 'bg-secondary text-on-secondary';
    return 'bg-surface-variant text-on-surface-variant';
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-display-sm font-bold text-on-surface">Risk Profile</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center text-center">
          <div className="text-label-md text-on-surface-variant uppercase mb-2">Overall Risk</div>
          <div className={cn("px-4 py-1.5 rounded-full font-bold text-lg", getRiskColor(report.overall_risk_rating))}>
            {report.overall_risk_rating || 'Unknown'}
          </div>
        </div>
        
        <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center text-center">
          <div className="text-label-md text-on-surface-variant uppercase mb-2">Risk Score</div>
          <div className="text-display-sm font-bold text-on-surface">{report.risk_score || '--'}<span className="text-title-md text-on-surface-variant">/100</span></div>
        </div>

        <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center text-center">
          <div className="text-label-md text-on-surface-variant uppercase mb-2">Volatility</div>
          <div className="text-title-lg font-bold text-on-surface">{report.volatility || 'Moderate'}</div>
        </div>

        <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col items-center justify-center text-center">
          <div className="text-label-md text-on-surface-variant uppercase mb-2">Liquidity</div>
          <div className="text-title-lg font-bold text-on-surface">{report.liquidity || 'High'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30">
          <h3 className="text-title-lg font-bold text-error mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined">trending_down</span> Identified Weaknesses
          </h3>
          {report.weaknesses && report.weaknesses.length > 0 ? (
            <ul className="space-y-3">
              {report.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-3 p-3 bg-error/5 rounded-lg border border-error/10">
                  <span className="material-symbols-outlined text-error text-[20px]">warning</span>
                  <span className="text-body-md text-on-surface">{w}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant">No major weaknesses identified.</p>
          )}
        </section>

        <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30">
          <h3 className="text-title-lg font-bold text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined">shield</span> Mitigation Recommendations
          </h3>
          {report.recommendations && report.recommendations.length > 0 ? (
            <ul className="space-y-3">
              {report.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                  <span className="text-body-md text-on-surface">{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant">No specific mitigations provided.</p>
          )}
        </section>
      </div>
    </div>
  );
};
