import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const STEPS = ['research', 'strategy', 'risk', 'decision'] as const;

const STEP_META: Record<string, { label: string; icon: string; phases: string[] }> = {
  research: {
    label: 'Research agent',
    icon: 'manage_search',
    phases: ['Fetching market data…', 'Analyzing fundamentals…', 'Reading news articles…', 'Calculating technicals…'],
  },
  strategy: {
    label: 'Strategy agent',
    icon: 'analytics',
    phases: ['Generating investment thesis…', 'Building bull and bear cases…', 'Defining entry and exit…'],
  },
  risk: {
    label: 'Risk agent',
    icon: 'shield',
    phases: ['Evaluating volatility…', 'Assessing valuation risk…', 'Scoring news risk…'],
  },
  decision: {
    label: 'Decision agent',
    icon: 'gavel',
    phases: ['Weighing all evidence…', 'Preparing final recommendation…'],
  },
};

interface AnimatedLoadingProps {
  currentStep?: string;
}

export const AnimatedLoading: React.FC<AnimatedLoadingProps> = ({ currentStep }) => {
  const activeIndex = STEPS.indexOf((currentStep || 'research') as (typeof STEPS)[number]);

  return (
    <div className="flex flex-col items-center gap-6 py-6" aria-busy="true">
      <div className="text-center">
        <div className="mb-1 inline-flex items-center gap-2 text-ink">
          <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
          <span className="text-sm font-semibold">Running research</span>
        </div>
        <p className="text-xs text-ink-muted">The agents work in sequence; the report appears when all of them have finished.</p>
      </div>

      <ol className="flex w-full max-w-lg flex-col gap-2">
        {STEPS.map((step, idx) => {
          const meta = STEP_META[step];
          const isDone = activeIndex > idx;
          const isActive = activeIndex === idx;

          return (
            <li key={step} className={cn('flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition-colors', isActive ? 'border-accent-line' : 'border-line', !isDone && !isActive && 'opacity-60')}>
              <span
                className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs', isActive ? 'bg-accent-soft text-accent-ink' : isDone ? 'bg-slate-100 text-accent' : 'bg-slate-50 text-ink-muted')}
                aria-hidden="true"
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{meta.label}</span>
                  <span className="text-xs text-ink-muted">{isDone ? 'Completed' : isActive ? 'Running' : 'Waiting'}</span>
                </div>
                {isActive && <div className="mt-0.5 text-xs text-ink-muted">{meta.phases[Math.floor(Date.now() / 2000) % meta.phases.length]}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
