import React from 'react';
import { cn } from '../../utils/cn';

interface SectionCardProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  accent?: 'primary' | 'secondary' | 'error' | 'tertiary';
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, icon, children, className, accent = 'primary' }) => {
  const accentClass = {
    primary: 'border-primary/30',
    secondary: 'border-secondary/30',
    error: 'border-error/30',
    tertiary: 'border-tertiary/30',
  }[accent];

  return (
    <div className={cn('bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden', className)}>
      <div className={cn('px-6 py-4 border-b border-outline-variant/20 flex items-center gap-3', `border-l-4 ${accentClass}`)}>
        {icon && <span className="material-symbols-outlined text-on-surface-variant">{icon}</span>}
        <h2 className="text-title-lg font-bold text-on-surface tracking-tight">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
};
