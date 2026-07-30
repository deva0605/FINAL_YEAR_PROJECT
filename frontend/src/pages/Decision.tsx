import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { cn } from '../utils/cn';

export const Decision: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.decision_report;
  const targetAsset = workflowState?.research_report?.company || workflowState?.research_report?.symbol;

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">gavel</span>
        <h2 className="text-headline-sm font-bold">No Decision Data</h2>
        <p>Run an analysis from the dashboard to reach a final decision.</p>
      </div>
    );
  }

  const recUpper = report.recommendation?.toUpperCase() || '';
  const isBuy = recUpper.includes('BUY');
  const isSell = recUpper.includes('SELL');
  const isHold = recUpper.includes('HOLD');

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="text-center mb-6">
        <h2 className="text-label-lg uppercase tracking-widest text-on-surface-variant mb-2">Final Recommendation</h2>
        <div className="flex justify-center items-center gap-4">
          <div className={cn(
            "text-display-lg font-black px-8 py-2 rounded-xl border-4",
            isBuy ? "text-secondary border-secondary/30 bg-secondary/10" : 
            isSell ? "text-error border-error/30 bg-error/10" :
            isHold ? "text-tertiary border-tertiary/30 bg-tertiary/10" :
            "text-primary border-primary/30 bg-primary/10"
          )}>
            {report.recommendation || 'N/A'}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="text-title-md font-bold">{targetAsset}</span>
          <span className="text-on-surface-variant">•</span>
          <ConfidenceBadge confidence={report.confidence} />
        </div>
      </div>

      <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-md border border-outline-variant/30 flex flex-col gap-8">
        <div>
          <h3 className="text-title-lg font-bold text-primary mb-3">Executive Summary</h3>
          <p className="text-body-lg text-on-surface-variant leading-relaxed">
            {report.overall_summary}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-title-lg font-bold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">library_add_check</span> Supporting Evidence
            </h3>
            <ul className="space-y-3">
              {(report.supporting_evidence || []).map((ev, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">done</span>
                  <span className="text-on-surface-variant">{ev}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-title-lg font-bold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">format_list_numbered</span> Next Steps
            </h3>
            <ul className="space-y-3">
              {(report.next_steps || []).map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                    {i + 1}
                  </div>
                  <span className="text-on-surface-variant">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
