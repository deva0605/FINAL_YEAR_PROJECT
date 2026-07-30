import React from 'react';
import { cn } from '../../utils/cn';

interface ConfidenceBadgeProps {
  confidence: number;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence }) => {
  const percentage = Math.round(confidence * 100);
  
  let color = 'bg-surface-container text-on-surface-variant';
  if (percentage >= 80) color = 'bg-secondary/20 text-secondary border-secondary/30';
  else if (percentage >= 50) color = 'bg-tertiary/20 text-tertiary border-tertiary/30';
  else color = 'bg-error/20 text-error border-error/30';

  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold', color)}>
      <span className="material-symbols-outlined text-[14px]">psychology</span>
      {percentage}% Confidence
    </div>
  );
};
