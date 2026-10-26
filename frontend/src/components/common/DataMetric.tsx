import React from 'react';
import { cn } from '../../utils/cn';

interface DataMetricProps {
  label: string;
  value?: string | number | null;
  sub?: string;
  highlight?: boolean;
  className?: string;
}

/** One cell of a MetricGrid. Missing values render as an em dash with an accessible "not available". */
export const DataMetric: React.FC<DataMetricProps> = ({ label, value, sub, highlight, className }) => {
  const missing = value == null || value === '';
  return (
    <div className={cn('flex flex-col gap-0.5 bg-white px-4 py-3', className)}>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={cn('text-base tabular-nums', missing ? 'text-ink-faint' : highlight ? 'font-semibold text-ink' : 'font-medium text-ink')}>
        {missing ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">not available</span>
          </>
        ) : (
          value
        )}
      </dd>
      {sub && <div className="text-xs text-ink-muted">{sub}</div>}
    </div>
  );
};

/** Hairline-divided grid of metrics: denser and calmer than a box around every number. */
export const MetricGrid: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <dl className={cn('grid gap-px overflow-hidden rounded-lg border border-line bg-line', className)}>{children}</dl>
);
