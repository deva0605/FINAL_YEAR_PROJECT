import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { RiskPanel } from '../components/report/RiskPanel';

export const Risk: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.risk_report;

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <h2 className="text-lg font-semibold text-slate-900">No Risk Assessment Data</h2>
        <p className="text-sm">Run an analysis from the dashboard to generate a risk profile.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Risk Profile</h2>
      </div>
      <RiskPanel report={report} />
    </div>
  );
};
