import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { cn } from '../utils/cn';

export const Report: React.FC = () => {
  const { workflowState } = useWorkflowStore();

  if (!workflowState) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">public</span>
        <h2 className="text-headline-sm font-bold">No Report Available</h2>
        <p>Run a workflow to generate a comprehensive printable report.</p>
      </div>
    );
  }

  const { research_report, strategy_report, risk_report, decision_report } = workflowState;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto bg-surface-container-lowest p-8 sm:p-12 shadow-lg rounded-xl print:shadow-none print:p-0">
      {/* Report Header */}
      <div className="flex items-start justify-between border-b border-outline-variant/30 pb-6 mb-8">
        <div>
          <h1 className="text-display-sm font-bold text-on-surface mb-2">AI Investment Report</h1>
          <div className="text-title-lg text-primary">{research_report?.company || research_report?.symbol}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-on-surface-variant mb-4">{new Date().toLocaleDateString()}</div>
          <button onClick={handlePrint} className="print:hidden px-4 py-2 bg-surface-container-high rounded-lg text-sm font-bold hover:bg-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">print</span> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Decision Summary */}
      {decision_report && (
        <section className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="px-4 py-1.5 rounded-lg border-2 border-primary/20 bg-primary/10 text-primary font-black text-xl uppercase">
              {decision_report.recommendation}
            </div>
            <ConfidenceBadge confidence={decision_report.confidence} />
          </div>
          <p className="text-body-lg text-on-surface-variant leading-relaxed">
            {decision_report.overall_summary}
          </p>
        </section>
      )}

      {/* Strategy Section */}
      {strategy_report && (
        <section className="mb-10 page-break-inside-avoid">
          <h2 className="text-title-lg font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Investment Strategy</h2>
          <div className="mb-3">
            <span className="font-bold text-on-surface mr-2">Horizon:</span>
            <span className="text-on-surface-variant">{strategy_report.time_horizon}</span>
          </div>
          <div className="mb-4">
            <span className="font-bold text-on-surface mr-2">Approach:</span>
            <span className="text-on-surface-variant">{strategy_report.suggested_strategy}</span>
          </div>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            {strategy_report.reasoning}
          </p>
          
          {strategy_report.catalysts && (
            <div className="mt-4">
              <h4 className="font-bold mb-2">Key Catalysts</h4>
              <ul className="list-disc ml-5 text-on-surface-variant text-sm">
                {strategy_report.catalysts.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Risk Section */}
      {risk_report && (
        <section className="mb-10 page-break-inside-avoid">
          <h2 className="text-title-lg font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Risk Assessment</h2>
          <div className="flex gap-8 mb-4">
            <div>
              <span className="font-bold text-on-surface mr-2">Rating:</span>
              <span className="text-on-surface-variant">{risk_report.overall_risk_rating}</span>
            </div>
            <div>
              <span className="font-bold text-on-surface mr-2">Score:</span>
              <span className="text-on-surface-variant">{risk_report.risk_score}/100</span>
            </div>
          </div>
          
          {risk_report.weaknesses && (
            <div className="mt-4">
              <h4 className="font-bold mb-2">Primary Weaknesses</h4>
              <ul className="list-disc ml-5 text-on-surface-variant text-sm">
                {risk_report.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Research/Context Section */}
      {research_report?.context && (
        <section className="page-break-inside-avoid">
          <h2 className="text-title-lg font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Supporting Context & News</h2>
          <ul className="space-y-3">
            {research_report.context.slice(0, 5).map((ctx, idx) => (
              <li key={idx} className="text-sm text-on-surface-variant">
                • {ctx}
              </li>
            ))}
          </ul>
        </section>
      )}
      
      <div className="mt-12 pt-6 border-t border-outline-variant/30 text-center text-xs text-on-surface-variant print:block">
        Generated by Market Intelligence Workflow • BSE X GLOBAL ANALYTICS
      </div>
    </div>
  );
};
