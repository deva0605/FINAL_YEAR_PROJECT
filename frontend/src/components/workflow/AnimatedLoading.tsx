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
    <div className="flex flex-col items-center justify-center py-12 gap-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-2.5 text-emerald-600 mb-2">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm font-bold font-mono tracking-wide uppercase">Running Multi-Agent Synthesis</span>
        </div>
        <p className="text-xs text-slate-500">Executing institutional workflow parallel models...</p>
      </div>

      <div className="w-full max-w-lg flex flex-col gap-3">
        {STEPS.map((step, idx) => {
          const meta = STEP_META[step];
          const isDone = activeIndex > idx;
          const isActive = activeIndex === idx;
          const isPending = activeIndex < idx;

          return (
            <div
              key={step}
              className={cn(
                'flex items-center gap-4 p-3 rounded-xl border transition-all duration-500',
                isDone && 'bg-slate-50 border-slate-200/60',
                isActive && 'bg-white border-emerald-200 shadow-sm',
                isPending && 'border-slate-100 opacity-40',
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px]',
                isDone && 'bg-slate-100 text-slate-600',
                isActive && 'bg-emerald-100 text-emerald-600',
                isPending && 'bg-slate-50 text-slate-400',
              )}>
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                ) : isActive ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                ) : (
                  <span className="font-mono font-bold">{idx + 1}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className={cn('text-xs font-bold font-mono tracking-tight', isActive ? 'text-emerald-700' : isDone ? 'text-slate-700' : 'text-slate-400')}>
                  {meta.label}
                </div>
                {isActive && (
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5 animate-pulse">
                    {meta.phases[Math.floor(Date.now() / 2000) % meta.phases.length]}
                  </div>
                )}
                {isDone && <div className="text-[10px] font-mono text-slate-500 mt-0.5">200 OK — Task Completed</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
