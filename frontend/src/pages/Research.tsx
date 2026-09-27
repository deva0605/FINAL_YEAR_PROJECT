import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { MarketSnapshot } from '../components/report/MarketSnapshot';
import { TechnicalAnalysisPanel } from '../components/report/TechnicalAnalysisPanel';
import { FundamentalsPanel } from '../components/report/FundamentalsPanel';
import { NewsAnalysisPanel } from '../components/report/NewsAnalysisPanel';

export const Research: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.research_report;

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
        <h2 className="text-lg font-semibold text-slate-900">No Research Data</h2>
        <p className="text-sm">Run an analysis from the dashboard to generate a research report.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Research Findings</h2>
        <div className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-mono font-medium border border-slate-200">
          {report.company || report.symbol}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <MarketSnapshot report={report} />
         <TechnicalAnalysisPanel report={report} />
      </div>
      <FundamentalsPanel report={report} strategy={workflowState?.strategy_report} />
      <NewsAnalysisPanel report={report} />
    </div>
  );
};
