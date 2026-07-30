import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';

export const Strategies: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.strategy_report;

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">target</span>
        <h2 className="text-headline-sm font-bold">No Strategy Data</h2>
        <p>Run an analysis from the dashboard to generate an investment strategy.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-display-sm font-bold text-on-surface">Investment Strategy</h2>
        <ConfidenceBadge confidence={report.confidence} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-title-lg font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">lightbulb</span> Suggested Strategy
              </h3>
              <span className="px-3 py-1 bg-surface-container rounded-full text-sm font-bold text-on-surface">
                {report.time_horizon}
              </span>
            </div>
            <div className="text-headline-sm font-bold text-on-surface mb-4">
              {report.suggested_strategy}
            </div>
            <div className="text-body-md text-on-surface-variant leading-relaxed">
              {report.reasoning}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30">
            <h3 className="text-title-lg font-bold text-secondary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">rocket_launch</span> Catalysts
            </h3>
            {report.catalysts && report.catalysts.length > 0 ? (
              <ul className="space-y-2">
                {report.catalysts.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
                    {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-on-surface-variant">No catalysts specified.</p>
            )}
          </section>

          <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30">
            <h3 className="text-title-lg font-bold text-error mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span> Key Risks
            </h3>
            {report.risks && report.risks.length > 0 ? (
              <ul className="space-y-2">
                {report.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-on-surface-variant">No key risks identified here (check Risk tab).</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
