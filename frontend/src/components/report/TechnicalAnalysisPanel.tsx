import React from 'react';
import { ResearchReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { SentimentBadge } from '../common/Badges';
import { ExpandableText } from '../common/ExpandableText';
import { formatMoney } from '../../utils/currency';

interface TechnicalAnalysisPanelProps {
  report?: ResearchReport;
}

function relation(price?: number | null, average?: number | null): string | undefined {
  if (price == null || average == null) return undefined;
  if (price > average) return 'Above';
  if (price < average) return 'Below';
  return 'At';
}

export const TechnicalAnalysisPanel: React.FC<TechnicalAnalysisPanelProps> = ({ report }) => {
  const r = report;
  const ti = r?.technical_indicators;

  const price = r?.current_price ?? ti?.latest_close;
  const high52 = r?.high_52_week ?? ti?.high_52_week;
  const low52 = r?.low_52_week ?? ti?.low_52_week;
  const rsi = r?.rsi ?? ti?.rsi_14;
  const ma20 = r?.moving_averages?.['20d'] ?? ti?.moving_average_20;
  const ma50 = r?.moving_averages?.['50d'] ?? ti?.moving_average_50;

  const positionPct =
    price != null && high52 != null && low52 != null && high52 - low52 > 0
      ? Math.max(0, Math.min(100, ((price - low52) / (high52 - low52)) * 100))
      : null;

  const vs20 = relation(price, ma20);
  const vs50 = relation(price, ma50);

  return (
    <SectionCard id="technical" title="Technical analysis" description="Trend and momentum signals.">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-muted">Sentiment</span>
          <SentimentBadge sentiment={r?.sentiment} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-ink-muted">52-week range position</span>
            <span className="font-medium tabular-nums text-ink">{positionPct != null ? `${positionPct.toFixed(0)}%` : '—'}</span>
          </div>
          {positionPct != null ? (
            <>
              <div
                role="meter"
                aria-label="Position within the 52-week range"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(positionPct)}
                className="relative h-1.5 rounded-full bg-slate-200"
              >
                <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow" style={{ left: `${positionPct}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-xs tabular-nums text-ink-muted">
                <span>{formatMoney(low52, r?.currency, 0)}</span>
                <span>{formatMoney(high52, r?.currency, 0)}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-muted">Not available: the 52-week range could not be computed from the data received.</p>
          )}
        </div>

        {rsi != null && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-ink-muted">RSI (14)</span>
              <span className="font-medium tabular-nums text-ink">{rsi.toFixed(1)}</span>
            </div>
            <div
              role="meter"
              aria-label="RSI"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(rsi)}
              className="relative h-1.5 rounded-full bg-slate-200"
            >
              <div className="absolute inset-y-0 left-[30%] right-[30%] rounded-full bg-slate-300" aria-hidden="true" />
              <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow" style={{ left: `${Math.max(0, Math.min(100, rsi))}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-ink-muted">
              <span>Oversold &lt; 30</span>
              <span>Overbought &gt; 70</span>
            </div>
          </div>
        )}

        {(vs20 || vs50) && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
            {vs20 && (
              <span>
                Price vs 20-day average: <span className="font-medium text-ink-soft">{vs20}</span>
              </span>
            )}
            {vs50 && (
              <span>
                Price vs 50-day average: <span className="font-medium text-ink-soft">{vs50}</span>
              </span>
            )}
          </div>
        )}

        {r?.technical_summary && (
          <div className="border-t border-line pt-4">
            <h3 className="mb-1.5 text-xs font-semibold text-ink">Summary</h3>
            <ExpandableText text={r.technical_summary} />
          </div>
        )}
      </div>
    </SectionCard>
  );
};
