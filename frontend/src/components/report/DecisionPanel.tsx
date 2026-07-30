import React from 'react';
import { DecisionReport, StrategyReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { RecommendationBadge } from '../common/Badges';

interface DecisionPanelProps {
  report?: DecisionReport;
  strategy?: StrategyReport;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({ report, strategy }) => {
  if (!report) return null;

  const isRuleBased = report.reasoning?.includes('Rule-Based');

  return (
    <SectionCard title="Decision Agent — Final Recommendation" icon="gavel" accent="primary">
      <div className="flex flex-col md:flex-row md:items-center gap-8 mb-8">
        <div className="flex flex-col items-center gap-3">
          <RecommendationBadge recommendation={report.recommendation} large />
          <div className="text-center">
            <div className="text-label-sm text-on-surface-variant uppercase tracking-widest">Confidence</div>
            <div className="text-title-xl font-black text-on-surface">
              {report.confidence != null ? `${(report.confidence * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Executive Summary</div>
          <p className="text-body-lg text-on-surface leading-relaxed">{report.overall_summary}</p>

          {isRuleBased && (
            <div className="mt-3 flex items-center gap-2 text-label-sm text-tertiary">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Rule-Based Analysis (Gemini quota exceeded — deterministic scoring engine used)
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(report.supporting_evidence || []).length > 0 && (
          <div>
            <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Supporting Evidence</div>
            <ul className="space-y-2">
              {report.supporting_evidence!.map((ev, i) => (
                <li key={i} className="flex items-start gap-2 text-body-md text-on-surface-variant">
                  <span className="material-symbols-outlined text-secondary text-[16px] mt-0.5 flex-shrink-0">check</span>
                  {ev}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(report.next_steps || []).length > 0 && (
          <div>
            <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Recommended Next Steps</div>
            <ol className="space-y-2">
              {report.next_steps!.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-body-md text-on-surface-variant">
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {report.investment_horizon && (
        <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-widest">Investment Horizon: </span>
          <span className="font-bold text-on-surface">{report.investment_horizon}</span>
        </div>
      )}
    </SectionCard>
  );
};
