import React from 'react';
import { Scale } from 'lucide-react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { DecisionPanel } from '../components/report/DecisionPanel';
import { RecommendationBadge } from '../components/common/Badges';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { AnalysisSourceNotice } from '../components/common/AnalysisSourceNotice';

export const Decision: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.decision_report;

  if (!report) {
    return (
      <>
        <PageHeader title="Final recommendation" />
        <EmptyState icon={<Scale className="h-5 w-5" />} title="No decision yet" description="Run an analysis from the research workspace to reach a final decision." />
      </>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Final recommendation" description={workflowState?.research_report?.company} actions={<RecommendationBadge recommendation={report.recommendation} large />} />
      {workflowState && <AnalysisSourceNotice state={workflowState} />}
      <DecisionPanel report={report} strategy={workflowState?.strategy_report} />
    </div>
  );
};
