import React from 'react';
import { motion } from 'framer-motion';
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
  const isPending = status === 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: isPending ? 0.5 : 1, y: 0, scale: isActive ? 1.01 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'relative overflow-hidden rounded-xl border transition-colors',
        isActive ? 'bg-white shadow-sm border-emerald-200' : 
        isCompleted ? 'bg-slate-50/50 border-slate-200/60' : 
        'bg-slate-50/30 border-slate-100'
      )}
    >
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <motion.div 
            layout
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold border',
              isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              isCompleted ? 'bg-slate-100 text-slate-700 border-slate-200' :
              'bg-white text-slate-400 border-slate-100'
            )}
          >
            {isCompleted ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
            ) : isActive ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            ) : (
              '--'
            )}
          </motion.div>
          
          <div className="flex-1 min-w-0">
            <motion.h3 layout className={cn('text-xs font-mono font-bold tracking-tight', isActive ? 'text-emerald-800' : isCompleted ? 'text-slate-800' : 'text-slate-500')}>
              {name}
            </motion.h3>
            
            {isActive && (
              <div className="mt-0.5">
                <ThinkingMessage messages={messages} interval={1200} />
              </div>
            )}
            {isCompleted && (
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">Status: SUCCESS_200</div>
            )}
          </div>
        </div>

        {isActive && (
          <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, progress)}%` }}
              transition={{ ease: "easeOut", duration: 0.5 }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};
