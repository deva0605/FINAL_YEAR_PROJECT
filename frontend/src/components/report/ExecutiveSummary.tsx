import React from 'react';
import { WorkflowState } from '../../types';
import { RecommendationBadge, RiskBadge, SentimentBadge } from '../common/Badges';
import { cn } from '../../utils/cn';

interface ExecutiveSummaryProps {
  state: WorkflowState;
  query?: string;
}

function fmtDate(iso?: string) {
  if (!iso) return 'Just now';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function isRuleBased(state: WorkflowState) {
  return (
    state.strategy_report?.reasoning?.includes('Rule-Based') ||
    state.decision_report?.reasoning?.includes('Rule-Based')
  );
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ state, query }) => {
  const { research_report: rr, decision_report: dr, strategy_report: sr, risk_report: risk, metadata } = state;
  const company = rr?.company || rr?.ticker || rr?.symbol || query || '—';
  const ticker = rr?.ticker || rr?.symbol || '—';
  const ruleBased = isRuleBased(state);

  return (
    <div className="bg-gradient-to-br from-surface-container to-surface-container-low rounded-2xl border border-outline-variant/20 p-8">
      {/* Top row */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-[28px]">corporate_fare</span>
            <div>
              <h1 className="text-display-sm font-black text-on-surface leading-none">{company}</h1>
              {ticker !== company && (
                <span className="text-label-lg text-on-surface-variant font-mono">{ticker}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {rr?.sector && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">
                {rr.sector}
              </span>
            )}
            {rr?.industry && (
              <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-xs rounded-full border border-outline-variant/20">
                {rr.industry}
              </span>
            )}
            <span className={cn(
              'px-2 py-0.5 text-xs font-bold rounded-full border',
              ruleBased
                ? 'bg-tertiary/10 text-tertiary border-tertiary/20'
                : 'bg-secondary/10 text-secondary border-secondary/20'
            )}>
              {ruleBased ? '⚙ Rule-Based Analysis' : '✦ AI-Enhanced Analysis'}
            </span>
          </div>
        </div>

        {/* Big recommendation */}
        <div className="flex flex-col items-center md:items-end gap-2">
          <RecommendationBadge recommendation={dr?.recommendation} large />
          <div className="flex items-center gap-2 text-label-md text-on-surface-variant">
            <span>Confidence:</span>
            <span className="font-bold text-on-surface">
              {dr?.confidence != null ? `${(dr.confidence * 100).toFixed(0)}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Current Price</div>
          <div className="text-title-xl font-bold text-on-surface">
            {rr?.current_price != null ? `$${rr.current_price.toFixed(2)}` : '—'}
          </div>
        </div>
        <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Investment Horizon</div>
          <div className="text-title-md font-bold text-on-surface">{sr?.time_horizon || dr?.investment_horizon || '—'}</div>
        </div>
        <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Overall Risk</div>
          <RiskBadge risk={risk?.overall_risk_rating || risk?.overall_risk} />
        </div>
        <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Market Sentiment</div>
          <SentimentBadge sentiment={rr?.sentiment} />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-outline-variant/20 flex flex-wrap gap-4 items-center justify-between text-label-sm text-on-surface-variant">
        <span>Generated: {fmtDate(metadata?.completed_at)}</span>
        {metadata?.execution_time_seconds != null && (
          <span>Execution time: {metadata.execution_time_seconds.toFixed(1)}s</span>
        )}
        {(rr?.sources || []).length > 0 && (
          <span>Sources: {rr!.sources!.length} URL(s)</span>
        )}
      </div>
    </div>
  );
};
