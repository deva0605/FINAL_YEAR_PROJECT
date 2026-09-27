import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { DecisionPanel } from '../components/report/DecisionPanel';

export const Decision: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.decision_report;

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <h2 className="text-lg font-semibold text-slate-900">No Decision Data</h2>
        <p className="text-sm">Run an analysis from the dashboard to reach a final decision.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Final Recommendation</h2>
      </div>
      <DecisionPanel report={report} strategy={workflowState?.strategy_report} />
    </div>
  );
};
