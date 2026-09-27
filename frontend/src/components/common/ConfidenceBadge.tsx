import React from 'react';
import { cn } from '../../utils/cn';

interface ConfidenceBadgeProps {
  confidence: number;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence }) => {
  const percentage = Math.round(confidence * 100);
  
  let color = 'bg-slate-50 text-slate-600 border-slate-200';
  if (percentage >= 80) color = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
  else if (percentage >= 50) color = 'bg-amber-50 text-amber-700 border-amber-200/60';
  else color = 'bg-rose-50 text-rose-700 border-rose-200/60';

  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium border', color)}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 2a8 8 0 0 1 8 8v2l2 2v2h-2v2a2 2 0 0 1-2 2h-1v-2h-2v2h-2v-2H9v2H7v-2H5a2 2 0 0 1-2-2v-2H1v-2l2-2v-2a8 8 0 0 1 8-8z" />
      </svg>
      {percentage}% Confidence
    </div>
  );
};
