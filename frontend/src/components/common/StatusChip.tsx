import React from 'react';
import { cn } from '../../utils/cn';

interface StatusChipProps {
  status: 'waiting' | 'running' | 'completed' | 'error';
  label?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, label }) => {
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);
  
  return (
    <div className={cn(
      "text-xs px-2 py-1 rounded-full font-medium tracking-wide inline-flex items-center gap-1.5 transition-colors",
      status === 'completed' && "bg-secondary/10 text-secondary",
      status === 'running' && "bg-primary/10 text-primary",
      status === 'waiting' && "bg-surface-variant text-on-surface-variant",
      status === 'error' && "bg-error/10 text-error"
    )}>
      {status === 'running' && <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>}
      {displayLabel}
    </div>
  );
};
