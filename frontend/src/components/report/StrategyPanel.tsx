import React from 'react';
import { StrategyReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { DataMetric, MetricGrid } from '../common/DataMetric';
import { Disclosure } from '../common/Disclosure';
import { formatPercent } from '../../utils/format';

interface StrategyPanelProps {
  report?: StrategyReport;
}

function Case({ title, text, tone }: { title: string; text?: string; tone: 'accent' | 'danger' }) {
  return (
    <div className={tone === 'accent' ? 'border-l-2 border-accent pl-3' : 'border-l-2 border-danger pl-3'}>
      <h3 className="text-xs font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{text || '—'}</p>
    </div>
  );
}

export const StrategyPanel: React.FC<StrategyPanelProps> = ({ report }) => {
  if (!report) return null;

  const catalysts = report.catalysts || [];
  const hasDetail = !!report.reasoning || catalysts.length > 0;

  return (
    <SectionCard id="strategy" title="Strategy" description="Bull and bear cases, with price levels to act on.">
      <div className="space-y-4">
        <Case title="Bull case" text={report.bull_thesis} tone="accent" />
        <Case title="Bear case" text={report.bear_thesis} tone="danger" />
      </div>

      <MetricGrid className="mt-5 grid-cols-1 sm:grid-cols-3">
        <DataMetric label="Entry zone" value={report.entry_zone} />
        <DataMetric label="Exit / stop" value={report.exit_zone} />
        <DataMetric label="Target" value={report.target} highlight />
      </MetricGrid>

      {report.suggested_strategy && (
        <div className="mt-5 rounded-lg bg-canvas px-4 py-3">
          <h3 className="text-xs text-ink-muted">Suggested approach</h3>
          <p className="mt-0.5 text-sm font-medium text-ink">{report.suggested_strategy}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {[report.time_horizon, report.confidence != null ? `${formatPercent(report.confidence)} confidence` : undefined].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}

      {hasDetail && (
        <Disclosure label="Reasoning and catalysts" className="mt-4">
          {report.reasoning && <p className="text-sm leading-relaxed text-ink-soft">{report.reasoning}</p>}
          {catalysts.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {catalysts.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                  <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          )}
        </Disclosure>
      )}
    </SectionCard>
  );
};
