import React from 'react';
import { WorkflowState } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { cn } from '../../utils/cn';

interface WorkflowTimelineProps {
  state: WorkflowState;
}

const AGENT_STEPS = [
  { key: 'research', label: 'Research Agent' },
  { key: 'strategy', label: 'Strategy Agent' },
  { key: 'risk', label: 'Risk Agent' },
  { key: 'decision', label: 'Decision Agent' },
];

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ state }) => {
  const completed = state.metadata?.completed_steps || [];
  const meta = state.metadata;
  const execTime = meta?.execution_time_seconds;

  return (
    <SectionCard title="Execution Graph" badge="Trace">
      <div className="flex flex-col gap-3">
        {AGENT_STEPS.map((step, idx) => {
          const isDone = completed.includes(step.key) || completed.includes('complete');
          return (
            <div key={step.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  isDone ? 'bg-emerald-500' : 'bg-slate-300'
                )} />
                <span className={cn('text-xs font-mono font-medium', isDone ? 'text-slate-900' : 'text-slate-500')}>
                  {step.label}
                </span>
              </div>
              {isDone && (
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">200 OK</span>
              )}
            </div>
          );
        })}
      </div>

      {execTime != null && (
        <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-slate-400 pt-4 border-t border-slate-100">
          <span>Total Latency</span>
          <span className="text-slate-900 font-bold tabular-nums">{execTime.toFixed(2)}s</span>
        </div>
      )}
    </SectionCard>
  );
};
