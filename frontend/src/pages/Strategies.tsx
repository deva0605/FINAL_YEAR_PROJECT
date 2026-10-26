import React from 'react';
import { Activity } from 'lucide-react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { StrategyPanel } from '../components/report/StrategyPanel';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { AnalysisSourceNotice } from '../components/common/AnalysisSourceNotice';

export const Strategies: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.strategy_report;

  if (!report) {
    return (
      <>
        <PageHeader title="Investment strategy" />
        <EmptyState icon={<Activity className="h-5 w-5" />} title="No strategy yet" description="Run an analysis from the research workspace to generate an investment strategy." />
      </>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Investment strategy" description={workflowState?.research_report?.company} />
      {workflowState && <AnalysisSourceNotice state={workflowState} />}
      <StrategyPanel report={report} />
    </div>
  );
};
