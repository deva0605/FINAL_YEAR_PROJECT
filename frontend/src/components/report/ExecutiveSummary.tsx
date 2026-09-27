import React from 'react';
import { WorkflowState } from '../../types';
import { RecommendationBadge, RiskBadge, SentimentBadge } from '../common/Badges';

interface ExecutiveSummaryProps {
  state: WorkflowState;
  query?: string;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ state, query }) => {
  const { research_report: rr, decision_report: dr, strategy_report: sr, risk_report: risk } = state;
  const company = rr?.company || rr?.ticker || rr?.symbol || query || '—';
  const ticker = rr?.ticker || rr?.symbol || '—';

  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-mono font-bold tracking-wider">
              {ticker.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">{company}</h1>
              <span className="text-xs text-slate-500 font-mono">{ticker}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {rr?.sector && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium font-mono rounded-md border border-slate-200 uppercase">
                {rr.sector}
              </span>
            )}
            {rr?.industry && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium font-mono rounded-md border border-slate-200 uppercase">
                {rr.industry}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center md:items-end gap-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Final Verdict</div>
          <RecommendationBadge recommendation={dr?.recommendation} large />
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 font-mono">
            <span>Confidence:</span>
            <span className="font-bold text-slate-900">
              {dr?.confidence != null ? `${(dr.confidence * 100).toFixed(0)}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Current Price</span>
          <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
            {rr?.current_price != null ? `$${rr.current_price.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Time Horizon</span>
          <span className="text-sm font-semibold text-slate-700 mt-1">
            {sr?.time_horizon || dr?.investment_horizon || '—'}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Overall Risk</span>
          <div className="mt-1"><RiskBadge risk={risk?.overall_risk_rating || risk?.overall_risk} /></div>
        </div>
        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Sentiment</span>
          <div className="mt-1"><SentimentBadge sentiment={rr?.sentiment} /></div>
        </div>
      </div>
    </div>
  );
};
