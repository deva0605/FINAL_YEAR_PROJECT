import React from 'react';
import { CheckCircle2, CircleDashed, Info, Loader2, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Tone, TONE_BADGE } from './tone';

export type AgentStatus = 'waiting' | 'running' | 'completed' | 'fallback' | 'error';

interface StatusChipProps {
  status: AgentStatus;
  label?: string;
}

const META: Record<AgentStatus, { text: string; tone: Tone; Icon: React.ComponentType<{ className?: string }> }> = {
  waiting: { text: 'Waiting', tone: 'neutral', Icon: CircleDashed },
  running: { text: 'Running', tone: 'caution', Icon: Loader2 },
  completed: { text: 'Completed', tone: 'accent', Icon: CheckCircle2 },
  fallback: { text: 'Completed (rule-based)', tone: 'caution', Icon: Info },
  error: { text: 'Failed', tone: 'danger', Icon: XCircle },
};

/** Status is always conveyed by an icon and text, never by colour alone. */
export const StatusChip: React.FC<StatusChipProps> = ({ status, label }) => {
  const { text, tone, Icon } = META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium', TONE_BADGE[tone])}>
      <Icon className={cn('h-3.5 w-3.5', status === 'running' && 'animate-spin')} aria-hidden="true" />
      {label || text}
    </span>
  );
};
