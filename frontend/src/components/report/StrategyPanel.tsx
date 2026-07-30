import React from 'react';
import { StrategyReport } from '../../types';
import { SectionCard } from '../common/SectionCard';

interface StrategyPanelProps {
  report?: StrategyReport;
}

function EvidenceList({ items, color = 'primary' }: { items?: string[]; color?: string }) {
  if (!items?.length) return <p className="text-on-surface-variant text-body-md">Not available.</p>;
  return (
    <ul className="space-y-2 mt-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-body-md text-on-surface-variant">
          <span className={`material-symbols-outlined text-[18px] mt-0.5 text-${color} flex-shrink-0`}>arrow_right</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export const StrategyPanel: React.FC<StrategyPanelProps> = ({ report }) => {
  if (!report) return null;

  return (
    <SectionCard title="Strategy Agent" icon="analytics" accent="secondary">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="p-4 bg-secondary/5 rounded-xl border border-secondary/20">
          <div className="text-label-sm text-secondary uppercase tracking-widest mb-2 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">trending_up</span> Bull Case
          </div>
          <p className="text-body-md text-on-surface leading-relaxed">{report.bull_thesis || '—'}</p>
        </div>
        <div className="p-4 bg-error/5 rounded-xl border border-error/20">
          <div className="text-label-sm text-error uppercase tracking-widest mb-2 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">trending_down</span> Bear Case
          </div>
          <p className="text-body-md text-on-surface leading-relaxed">{report.bear_thesis || '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Entry Zone</div>
          <div className="font-bold text-on-surface">{report.entry_zone || '—'}</div>
        </div>
        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Exit / Stop-Loss</div>
          <div className="font-bold text-on-surface">{report.exit_zone || '—'}</div>
        </div>
        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Price Target</div>
          <div className="font-bold text-primary">{report.target || '—'}</div>
        </div>
      </div>

      {(report.catalysts || []).length > 0 && (
        <div className="mb-6">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Key Catalysts</div>
          <EvidenceList items={report.catalysts} color="secondary" />
        </div>
      )}

      {report.suggested_strategy && (
        <div className="p-4 bg-surface-container rounded-xl border-l-4 border-primary/30">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Suggested Approach</div>
          <p className="font-bold text-on-surface">{report.suggested_strategy}</p>
        </div>
      )}

      {report.reasoning && (
        <div className="mt-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Strategy Reasoning</div>
          <p className="text-body-md text-on-surface-variant leading-relaxed">{report.reasoning}</p>
        </div>
      )}
    </SectionCard>
  );
};
