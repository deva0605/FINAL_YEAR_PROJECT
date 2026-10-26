import React from 'react';
import { cn } from '../../utils/cn';
import { Tone, TONE_BADGE } from './tone';

interface ConfidenceBadgeProps {
  confidence: number;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence }) => {
  const percentage = Math.round(confidence * 100);
  const tone: Tone = percentage >= 80 ? 'accent' : percentage >= 50 ? 'caution' : 'danger';

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums', TONE_BADGE[tone])}>
      {percentage}% confidence
    </span>
  );
};
