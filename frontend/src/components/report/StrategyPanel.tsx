import React from 'react';
import { StrategyReport } from '../../types';
import { SectionCard } from '../common/SectionCard';

interface StrategyPanelProps {
  report?: StrategyReport;
}

export const StrategyPanel: React.FC<StrategyPanelProps> = ({ report }) => {
  if (!report) return null;

  return (
    <SectionCard title="Strategy Agent" badge="Alpha">
      <div className="grid grid-cols-1 gap-4 mb-5">
        <div className="p-3 bg-white border border-emerald-200/60 rounded-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500" />
          <div className="text-[10px] font-mono text-emerald-700 uppercase tracking-widest mb-1.5 font-bold pl-2">Bull Case</div>
          <p className="text-xs text-slate-700 leading-relaxed pl-2">{report.bull_thesis || '—'}</p>
        </div>
        <div className="p-3 bg-white border border-rose-200/60 rounded-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-rose-500" />
          <div className="text-[10px] font-mono text-rose-700 uppercase tracking-widest mb-1.5 font-bold pl-2">Bear Case</div>
          <p className="text-xs text-slate-700 leading-relaxed pl-2">{report.bear_thesis || '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
          <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Entry Zone</div>
          <div className="text-xs font-bold text-slate-900">{report.entry_zone || '—'}</div>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
          <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Exit / Stop</div>
          <div className="text-xs font-bold text-slate-900">{report.exit_zone || '—'}</div>
        </div>
        <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex flex-col gap-1">
          <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Target</div>
          <div className="text-xs font-bold text-white tabular-nums">{report.target || '—'}</div>
        </div>
      </div>

      {report.suggested_strategy && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Suggested Approach</div>
          <p className="text-sm font-semibold text-slate-800">{report.suggested_strategy}</p>
          {report.reasoning && (
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{report.reasoning}</p>
          )}
        </div>
      )}
    </SectionCard>
  );
};
