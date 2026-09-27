import React from 'react';
import { cn } from '../../utils/cn';

interface StatusChipProps {
  status: 'waiting' | 'running' | 'completed' | 'error';
  label?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, label }) => {
  const displayLabel = label || status.toUpperCase();
  
  return (
    <div className={cn(
      "px-2 py-0.5 text-[9px] font-mono font-medium rounded border tracking-wider uppercase inline-flex items-center gap-1.5 transition-colors",
      status === 'completed' && "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      status === 'running' && "bg-amber-50 text-amber-700 border-amber-200/60",
      status === 'waiting' && "bg-slate-50 text-slate-500 border-slate-200",
      status === 'error' && "bg-rose-50 text-rose-700 border-rose-200/60"
    )}>
      {status === 'running' && (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )}
      {displayLabel}
    </div>
  );
};
