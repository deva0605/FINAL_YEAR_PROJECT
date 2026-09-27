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
  <div className={cn('flex flex-col gap-1 p-3 bg-white rounded-lg border border-slate-200/80 hover:border-slate-300 transition shadow-xs', className)}>
    <span className="text-[10px] font-mono font-medium text-slate-400 uppercase">{label}</span>
    <span className={cn('text-sm font-bold font-mono tabular-nums', highlight ? 'text-slate-900' : 'text-slate-700')}>
      {value ?? '—'}
    </span>
    {sub && <span className="text-[10px] text-slate-400 font-mono">{sub}</span>}
  </div>
);
