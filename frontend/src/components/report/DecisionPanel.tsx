import React from 'react';
import { DecisionReport, StrategyReport } from '../../types';
import { SectionCard } from '../common/SectionCard';

interface DecisionPanelProps {
  report?: DecisionReport;
  strategy?: StrategyReport;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({ report }) => {
  if (!report) return null;

  const evidence = report.supporting_evidence || [];
  const steps = report.next_steps || [];

  return (
    <SectionCard id="decision" title="Decision" description="The combined view of research, strategy and risk.">
      {report.overall_summary ? (
        <p className="text-sm leading-relaxed text-ink-soft">{report.overall_summary}</p>
      ) : (
        <p className="text-sm text-ink-muted">No summary was provided for this decision.</p>
      )}

      {(evidence.length > 0 || steps.length > 0) && (
        <div className="mt-5 grid grid-cols-1 gap-6 border-t border-line pt-5 md:grid-cols-2">
          {evidence.length > 0 && (
            <div>
              <h3 className="mb-2.5 text-xs font-semibold text-ink">Supporting evidence</h3>
              <ul className="space-y-2">
                {evidence.map((ev, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                    <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />
                    {ev}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {steps.length > 0 && (
            <div>
              <h3 className="mb-2.5 text-xs font-semibold text-ink">Recommended next steps</h3>
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-xs font-medium tabular-nums text-ink-muted">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
};
