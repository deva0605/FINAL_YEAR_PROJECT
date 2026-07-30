import React from 'react';
import { WorkflowState } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { cn } from '../../utils/cn';

interface ExplainabilityPanelProps {
  state: WorkflowState;
}

interface FlowStepProps {
  icon: string;
  label: string;
  content?: string | string[];
  color?: string;
  isLast?: boolean;
}

const FlowStep: React.FC<FlowStepProps> = ({ icon, label, content, color = 'primary', isLast }) => (
  <div className="flex gap-4">
    <div className="flex flex-col items-center">
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', `bg-${color}/10 text-${color}`)}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      {!isLast && <div className="w-0.5 flex-1 bg-outline-variant/30 my-2 min-h-[24px]" />}
    </div>
    <div className={cn('pb-6', isLast && 'pb-0')}>
      <div className={cn('font-bold text-body-lg mb-1', `text-${color}`)}>{label}</div>
      {Array.isArray(content) ? (
        <ul className="space-y-1">
          {content.slice(0, 4).map((c, i) => (
            <li key={i} className="text-body-md text-on-surface-variant">{c}</li>
          ))}
        </ul>
      ) : (
        <p className="text-body-md text-on-surface-variant leading-relaxed">{content || 'No data.'}</p>
      )}
    </div>
  </div>
);

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({ state }) => {
  const { research_report: rr, strategy_report: sr, risk_report: risk, decision_report: dr } = state;

  const researchEvidence = [
    rr?.fundamental_summary ? `Fundamentals: ${rr.fundamental_summary.slice(0, 120)}...` : null,
    rr?.technical_summary ? `Technicals: ${rr.technical_summary.slice(0, 120)}...` : null,
    rr?.latest_news?.length ? `News: ${rr.latest_news.length} articles analysed (${rr.sentiment} sentiment)` : null,
  ].filter(Boolean) as string[];

  const riskFactors = [
    ...(risk?.reasons || []).slice(0, 3),
    risk?.overall_risk_rating ? `Overall Risk Rating: ${risk.overall_risk_rating}` : null,
  ].filter(Boolean) as string[];

  return (
    <SectionCard title="Explainability — Why This Recommendation?" icon="lightbulb" accent="tertiary">
      <p className="text-body-md text-on-surface-variant mb-6">
        This section explains the reasoning chain of each AI agent. Designed for transparency and Explainable AI.
      </p>
      <FlowStep
        icon="manage_search"
        label="Research Agent — Data Collected"
        content={researchEvidence.length > 0 ? researchEvidence : ['Market data, news, and fundamentals retrieved from Yahoo Finance.']}
        color="primary"
      />
      <FlowStep
        icon="analytics"
        label="Strategy Agent — Investment Thesis"
        content={sr?.reasoning || sr?.suggested_strategy || '—'}
        color="secondary"
      />
      <FlowStep
        icon="shield"
        label="Risk Agent — Risk Factors Identified"
        content={riskFactors.length > 0 ? riskFactors : ['Risk assessed using volatility, valuation, and liquidity metrics.']}
        color="error"
      />
      <FlowStep
        icon="gavel"
        label="Decision Agent — Final Logic"
        content={dr?.reasoning || '—'}
        color="tertiary"
        isLast
      />
    </SectionCard>
  );
};
