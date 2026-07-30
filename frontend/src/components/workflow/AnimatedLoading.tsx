import React from 'react';
import { cn } from '../../utils/cn';

const STEPS = ['research', 'strategy', 'risk', 'decision'] as const;

const STEP_META: Record<string, { label: string; icon: string; phases: string[] }> = {
  research: {
    label: 'Research Agent',
    icon: 'manage_search',
    phases: ['Fetching Market Data...', 'Analyzing Fundamentals...', 'Reading News Articles...', 'Calculating Technicals...'],
  },
  strategy: {
    label: 'Strategy Agent',
    icon: 'analytics',
    phases: ['Generating Investment Thesis...', 'Building Bull & Bear Cases...', 'Defining Entry & Exit...'],
  },
  risk: {
    label: 'Risk Agent',
    icon: 'shield',
    phases: ['Evaluating Volatility...', 'Assessing Valuation Risk...', 'Scoring News Risk...'],
  },
  decision: {
    label: 'Decision Agent',
    icon: 'gavel',
    phases: ['Weighing All Evidence...', 'Preparing Final Recommendation...'],
  },
};

interface AnimatedLoadingProps {
  currentStep?: string;
}

export const AnimatedLoading: React.FC<AnimatedLoadingProps> = ({ currentStep }) => {
  const activeIndex = STEPS.indexOf((currentStep || 'research') as any);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-10">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 text-primary mb-3">
          <span className="material-symbols-outlined text-[28px] animate-spin">sync</span>
          <span className="text-title-lg font-bold">Running Multi-Agent Analysis</span>
        </div>
        <p className="text-body-md text-on-surface-variant">Our AI agents are working in sequence to produce your investment report</p>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-4">
        {STEPS.map((step, idx) => {
          const meta = STEP_META[step];
          const isDone = activeIndex > idx;
          const isActive = activeIndex === idx;
          const isPending = activeIndex < idx;

          return (
            <div
              key={step}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl border transition-all duration-500',
                isDone && 'bg-secondary/5 border-secondary/20',
                isActive && 'bg-primary/5 border-primary/30 shadow-md',
                isPending && 'border-outline-variant/10 opacity-40',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                isDone && 'bg-secondary/20 text-secondary',
                isActive && 'bg-primary/20 text-primary',
                isPending && 'bg-surface-container text-on-surface-variant',
              )}>
                {isDone ? (
                  <span className="material-symbols-outlined text-[20px]">check</span>
                ) : isActive ? (
                  <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className={cn('font-bold text-body-lg', isActive ? 'text-primary' : isDone ? 'text-secondary' : 'text-on-surface-variant')}>
                  {meta.label}
                </div>
                {isActive && (
                  <div className="text-label-md text-on-surface-variant mt-1 animate-pulse">
                    {meta.phases[Math.floor(Date.now() / 2000) % meta.phases.length]}
                  </div>
                )}
                {isDone && <div className="text-label-md text-secondary mt-1">Completed</div>}
              </div>

              {isDone && (
                <span className="material-symbols-outlined text-secondary">check_circle</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
};
