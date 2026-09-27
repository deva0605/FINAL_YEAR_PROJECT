import React from 'react';
import { ResearchReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { SentimentBadge } from '../common/Badges';

interface TechnicalAnalysisPanelProps {
  report?: ResearchReport;
}

export const TechnicalAnalysisPanel: React.FC<TechnicalAnalysisPanelProps> = ({ report }) => {
  const r = report;
  const ti = r?.technical_indicators;
  
  const price = r?.current_price ?? ti?.latest_close;
  const high52 = r?.high_52_week ?? ti?.high_52_week;
  const low52 = r?.low_52_week ?? ti?.low_52_week;

  const positionPct = (price && high52 && low52 && (high52 - low52) > 0)
    ? ((price - low52) / (high52 - low52)) * 100 : null;

  return (
    <SectionCard title="Technical Analysis" badge="Signals">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1.5">
          <div className="text-[10px] text-slate-400 uppercase font-mono tracking-widest">Sentiment</div>
          <div className="mt-1"><SentimentBadge sentiment={r?.sentiment} /></div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col justify-center">
          <div className="text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-2">52-Week Range Position</div>
          {positionPct != null ? (
            <>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden w-full relative">
                <div className="absolute top-0 bottom-0 left-0 bg-slate-900 rounded-full" style={{ width: `${positionPct}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[9px] font-mono text-slate-400">
                <span>${low52?.toFixed(0)}</span>
                <span className="text-slate-900 font-bold">{positionPct.toFixed(0)}%</span>
                <span>${high52?.toFixed(0)}</span>
              </div>
            </>
          ) : <span className="text-xs text-slate-400">—</span>}
        </div>
      </div>

      {r?.technical_summary && (
        <div className="text-xs text-slate-600 leading-relaxed bg-white border border-slate-200 p-4 rounded-lg">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Technical Summary</div>
          {r.technical_summary}
        </div>
      )}
    </SectionCard>
  );
};
