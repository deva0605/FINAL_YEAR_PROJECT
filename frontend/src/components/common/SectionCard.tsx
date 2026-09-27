import React from 'react';
import { cn } from '../../utils/cn';

interface SectionCardProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  accent?: 'primary' | 'secondary' | 'error' | 'tertiary';
  badge?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, icon, children, className, badge }) => {
  return (
    <div className={cn('bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden', className)}>
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-white">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 text-[10px] font-mono font-bold">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
          )}
          <h2 className="text-xs font-bold text-slate-900 tracking-tight uppercase">{title}</h2>
          {badge && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">{badge}</span>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
};
