import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { RiskPanel } from '../components/report/RiskPanel';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { AnalysisSourceNotice } from '../components/common/AnalysisSourceNotice';

export const Risk: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.risk_report;

  if (!report) {
    return (
      <>
        <PageHeader title="Risk profile" />
        <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No risk assessment yet" description="Run an analysis from the research workspace to generate a risk profile." />
      </>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Risk profile" description={workflowState?.research_report?.company} />
      {workflowState && <AnalysisSourceNotice state={workflowState} />}
      <RiskPanel report={report} />
    </div>
  );
};
