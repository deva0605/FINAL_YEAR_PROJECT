import React from 'react';
import { DecisionReport, StrategyReport } from '../../types';
import { SectionCard } from '../common/SectionCard';

interface DecisionPanelProps {
  report?: DecisionReport;
  strategy?: StrategyReport;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({ report }) => {
  if (!report) return null;

  return (
    <SectionCard title="Decision Engine" badge="Consensus">
      <div className="flex flex-col md:flex-row gap-8 mb-6">
        <div className="flex-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Executive Summary</div>
          <p className="text-sm text-slate-700 leading-relaxed">{report.overall_summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 rounded-xl border border-slate-100 p-5">
        {(report.supporting_evidence || []).length > 0 && (
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-3">Supporting Evidence</div>
            <ul className="space-y-2.5">
              {report.supporting_evidence!.map((ev, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                  {ev}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(report.next_steps || []).length > 0 && (
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-3">Recommended Next Steps</div>
            <ol className="space-y-2.5">
              {report.next_steps!.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                  <div className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 w-4 h-4 flex items-center justify-center rounded flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </SectionCard>
  );
};
