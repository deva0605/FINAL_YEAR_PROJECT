import React from 'react';
import { cn } from '../../utils/cn';

interface DataMetricProps {
  label: string;
  value?: string | number | null;
  sub?: string;
  highlight?: boolean;
  className?: string;
}

export const DataMetric: React.FC<DataMetricProps> = ({ label, value, sub, highlight, className }) => (
  <div className={cn('flex flex-col gap-1 p-4 bg-surface-container-low rounded-xl border border-outline-variant/10', className)}>
    <span className="text-label-sm uppercase tracking-widest text-on-surface-variant font-medium">{label}</span>
    <span className={cn('text-title-lg font-bold', highlight ? 'text-primary' : 'text-on-surface')}>
      {value ?? '—'}
    </span>
    {sub && <span className="text-label-sm text-on-surface-variant">{sub}</span>}
  </div>
);
