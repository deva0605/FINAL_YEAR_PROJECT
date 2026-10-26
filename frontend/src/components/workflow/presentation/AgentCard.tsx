import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { ThinkingMessage } from './ThinkingMessage';
import { cn } from '../../../utils/cn';

export interface AgentCardProps {
  id: string;
  name: string;
  icon: string;
  messages: string[];
  status: 'pending' | 'active' | 'completed';
  progress?: number;
}

export const AgentCard: React.FC<AgentCardProps> = ({ name, messages, status, progress = 0 }) => {
  const isCompleted = status === 'completed';
  const isActive = status === 'active';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: status === 'pending' ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('rounded-xl border bg-white px-4 py-3 transition-colors', isActive ? 'border-accent-line' : 'border-line')}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
            isActive ? 'bg-accent-soft text-accent-ink' : isCompleted ? 'bg-slate-100 text-accent' : 'bg-slate-50 text-ink-faint',
          )}
          aria-hidden="true"
        >
          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs">–</span>}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-ink">{name}</h3>
            <span className="text-xs text-ink-muted">{isCompleted ? 'Completed' : isActive ? 'Running' : 'Waiting'}</span>
          </div>
          {isActive && (
            <div className="mt-0.5">
              <ThinkingMessage messages={messages} interval={1200} />
            </div>
          )}
        </div>
      </div>

      {isActive && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(5, progress)}%` }}
            transition={{ ease: 'easeOut', duration: 0.5 }}
          />
        </div>
      )}
    </motion.li>
  );
};
