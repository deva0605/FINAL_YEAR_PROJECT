import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { StrategyPanel } from '../components/report/StrategyPanel';

export const Strategies: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.strategy_report;

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <h2 className="text-lg font-semibold text-slate-900">No Strategy Data</h2>
        <p className="text-sm">Run an analysis from the dashboard to generate an investment strategy.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Investment Strategy</h2>
      </div>
      <StrategyPanel report={report} />
    </div>
  );
};
