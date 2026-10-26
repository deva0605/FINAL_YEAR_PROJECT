import React from 'react';
import { Search } from 'lucide-react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { MarketSnapshot } from '../components/report/MarketSnapshot';
import { TechnicalAnalysisPanel } from '../components/report/TechnicalAnalysisPanel';
import { FundamentalsPanel } from '../components/report/FundamentalsPanel';
import { NewsAnalysisPanel } from '../components/report/NewsAnalysisPanel';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { AnalysisSourceNotice } from '../components/common/AnalysisSourceNotice';

export const Research: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.research_report;

  if (!report) {
    return (
      <>
        <PageHeader title="Research findings" />
        <EmptyState icon={<Search className="h-5 w-5" />} title="No research data yet" description="Run an analysis from the research workspace to see market data, technicals, fundamentals and news here." />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Research findings" description={[report.company, report.ticker].filter(Boolean).join(' · ') || report.symbol} />
      {workflowState && <AnalysisSourceNotice state={workflowState} />}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MarketSnapshot report={report} />
        <TechnicalAnalysisPanel report={report} />
      </div>
      <FundamentalsPanel report={report} strategy={workflowState?.strategy_report} />
      <NewsAnalysisPanel report={report} />
    </div>
  );
};
