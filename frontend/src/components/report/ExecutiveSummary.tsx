import React from 'react';
import { CheckCircle2, Clock, TriangleAlert, XCircle } from 'lucide-react';
import { WorkflowState } from '../../types';
import { RecommendationBadge, RiskBadge, SentimentBadge } from '../common/Badges';
import { formatMoney } from '../../utils/currency';
import { exchangeFor, formatDateTime, formatPercent } from '../../utils/format';
import { cn } from '../../utils/cn';

interface ExecutiveSummaryProps {
  state: WorkflowState;
  query?: string;
}

type RunStatus = { label: string; tone: 'accent' | 'caution' | 'danger'; Icon: React.ComponentType<{ className?: string }> };

function runStatus(state: WorkflowState): RunStatus {
  const meta = state.metadata;
  const warnings = state.research_report?.market_data_warnings?.length ?? 0;
  if (meta?.current_step === 'failed') return { label: 'Research failed', tone: 'danger', Icon: XCircle };
  if (meta?.errors?.length) return { label: 'Completed with errors', tone: 'danger', Icon: XCircle };
  if (warnings > 0) return { label: `Complete · ${warnings} data note${warnings === 1 ? '' : 's'}`, tone: 'caution', Icon: TriangleAlert };
  return { label: 'Research complete', tone: 'accent', Icon: CheckCircle2 };
}

const STATUS_TEXT = { accent: 'text-accent-ink', caution: 'text-caution-ink', danger: 'text-danger-ink' } as const;

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ state, query }) => {
  const { research_report: rr, decision_report: dr, strategy_report: sr, risk_report: risk } = state;
  const company = rr?.company || rr?.ticker || rr?.symbol || query || '—';
  const ticker = rr?.ticker || rr?.symbol;
  const exchange = exchangeFor(ticker);
  const status = runStatus(state);
  const updated = formatDateTime(state.metadata?.completed_at);
  const dataAsOf = formatDateTime(rr?.market_data_as_of);
  const confidence = dr?.confidence;

  const identity = [ticker, exchange, rr?.sector, rr?.industry].filter(Boolean) as string[];

  return (
    <section aria-labelledby="report-title" className="card p-5 sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 id="report-title" className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {company}
          </h1>
          {identity.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-muted">
              {identity.map((part, i) => (
                <React.Fragment key={part}>
                  {i > 0 && <span aria-hidden="true">·</span>}
                  <span className={i === 0 ? 'font-medium text-ink-soft' : undefined}>{part}</span>
                </React.Fragment>
              ))}
            </p>
          )}
          <div className="mt-4">
            <div className="text-xs text-ink-muted">Current price</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink">{formatMoney(rr?.current_price, rr?.currency)}</span>
              <span className="text-xs text-ink-muted">
                {rr?.current_price == null ? '' : rr?.currency ? rr.currency.toUpperCase() : 'currency unverified'}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full flex-shrink-0 rounded-xl border border-line bg-canvas p-4 md:w-64">
          <div className="text-xs text-ink-muted">Recommendation</div>
          <div className="mt-1.5">
            <RecommendationBadge recommendation={dr?.recommendation} large />
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-muted">Confidence</span>
              <span className="font-medium tabular-nums text-ink">{formatPercent(confidence) ?? '—'}</span>
            </div>
            {confidence != null && (
              <div
                role="meter"
                aria-label="Confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(confidence * 100)}
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200"
              >
                <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(0, Math.min(100, confidence * 100))}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-ink-muted">Time horizon</dt>
          <dd className="mt-0.5 text-sm font-medium text-ink">{sr?.time_horizon || dr?.investment_horizon || '—'}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-ink-muted">Overall risk</dt>
          <dd className="mt-1">
            <RiskBadge risk={risk?.overall_risk_rating || risk?.overall_risk} />
          </dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-ink-muted">Sentiment</dt>
          <dd className="mt-1">
            <SentimentBadge sentiment={rr?.sentiment} />
          </dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-ink-muted">Risk score</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink">
            {risk?.risk_score != null ? (
              <>
                {risk.risk_score.toFixed(0)}
                <span className="font-normal text-ink-muted"> / 100</span>
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted">
        <span className={cn('inline-flex items-center gap-1.5 font-medium', STATUS_TEXT[status.tone])}>
          <status.Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {status.label}
        </span>
        {updated && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Analysed {updated}
          </span>
        )}
        {rr?.market_data_source && (
          <span>
            Market data: {rr.market_data_source}
            {rr.market_data_freshness ? ` (${rr.market_data_freshness}` : ''}
            {rr.market_data_freshness ? (dataAsOf ? `, as of ${dataAsOf})` : ')') : dataAsOf ? ` (as of ${dataAsOf})` : ''}
          </span>
        )}
      </div>
    </section>
  );
};
