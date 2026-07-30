import React from 'react';
import { WorkflowState } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { cn } from '../../utils/cn';

interface WorkflowTimelineProps {
  state: WorkflowState;
}

const AGENT_STEPS = [
  { key: 'research', label: 'Research Agent', icon: 'manage_search', description: 'Fetched market data, fundamentals, technicals, and news.' },
  { key: 'strategy', label: 'Strategy Agent', icon: 'analytics', description: 'Generated investment thesis, bull/bear cases, entry/exit zones.' },
  { key: 'risk', label: 'Risk Agent', icon: 'shield', description: 'Assessed volatility, liquidity, valuation, and news risks.' },
  { key: 'decision', label: 'Decision Agent', icon: 'gavel', description: 'Synthesized all reports into a final BUY/HOLD/SELL recommendation.' },
];

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ state }) => {
  const completed = state.metadata?.completed_steps || [];
  const meta = state.metadata;
  const execTime = meta?.execution_time_seconds;
  const isRuleBased = state.strategy_report?.reasoning?.includes('Rule-Based');
  const newsCount = state.research_report?.latest_news?.length ?? 0;
  const sourcesCount = state.research_report?.sources?.length ?? 0;

  return (
    <SectionCard title="Workflow Timeline" icon="timeline" accent="primary">
      <div className="flex flex-wrap gap-4 mb-6 text-label-sm text-on-surface-variant">
        {execTime != null && (
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">timer</span>
            Execution: {execTime.toFixed(1)}s
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">article</span>
          News Articles: {newsCount}
        </div>
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">link</span>
          Sources: {sourcesCount}
        </div>
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">smart_toy</span>
          Engine: {isRuleBased ? 'Rule-Based Scoring' : 'Gemini AI'}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {AGENT_STEPS.map((step, idx) => {
          const isDone = completed.includes(step.key) || completed.includes('complete');
          return (
            <div key={step.key} className={cn(
              'flex items-start gap-4 p-4 rounded-xl border transition-all',
              isDone
                ? 'bg-secondary/5 border-secondary/20'
                : 'bg-surface-container-low border-outline-variant/10 opacity-60'
            )}>
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                isDone ? 'bg-secondary/20 text-secondary' : 'bg-surface-container text-on-surface-variant'
              )}>
                {isDone ? (
                  <span className="material-symbols-outlined text-[18px]">check</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
                )}
              </div>
              <div className="flex-1">
                <div className={cn('font-bold text-body-lg', isDone ? 'text-secondary' : 'text-on-surface-variant')}>
                  {step.label}
                  {isDone && <span className="ml-2 text-label-sm font-normal text-secondary">✓ Completed</span>}
                </div>
                <div className="text-body-md text-on-surface-variant mt-0.5">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};
