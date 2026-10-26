import React from 'react';
import { RiskReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { RiskBadge } from '../common/Badges';
import { Disclosure } from '../common/Disclosure';
import { TONE_DOT, toneForRisk } from '../common/tone';
import { cn } from '../../utils/cn';

interface RiskPanelProps {
  report?: RiskReport;
}

function RiskRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd>
        <RiskBadge risk={value} />
      </dd>
    </div>
  );
}

function TextList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold text-ink">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
            <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const RiskPanel: React.FC<RiskPanelProps> = ({ report }) => {
  if (!report) return null;

  const rating = report.overall_risk_rating || report.overall_risk;
  const tone = toneForRisk(rating || '');
  const detailCount = (report.reasons?.length ?? 0) + (report.weaknesses?.length ?? 0) + (report.recommendations?.length ?? 0);

  return (
    <SectionCard
      id="risk"
      title="Risk assessment"
      description="Where the main risks sit. A higher score means more risk."
      actions={rating ? <RiskBadge risk={rating} /> : undefined}
    >
      <dl>
        <RiskRow label="Volatility" value={report.volatility} />
        <RiskRow label="Liquidity" value={report.liquidity} />
        <RiskRow label="Valuation risk" value={report.valuation} />
        <RiskRow label="Financial risk" value={report.financial_risk} />
        <RiskRow label="News risk" value={report.news_risk} />
        <RiskRow label="Macro risk" value={report.macro_risk} />
      </dl>

      {report.risk_score != null && (
        <div className="mt-4 rounded-lg bg-canvas px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-ink-muted">Total risk score</span>
            <span className="text-lg font-semibold tabular-nums text-ink">
              {report.risk_score.toFixed(0)}
              <span className="text-sm font-normal text-ink-muted"> / 100</span>
            </span>
          </div>
          <div
            role="meter"
            aria-label="Total risk score"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(report.risk_score)}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
          >
            <div className={cn('h-full rounded-full', TONE_DOT[tone])} style={{ width: `${Math.max(0, Math.min(100, report.risk_score))}%` }} />
          </div>
        </div>
      )}

      {detailCount > 0 && (
        <Disclosure label="Why this rating" count={detailCount} className="mt-4">
          <div className="space-y-4">
            <TextList title="Reasons" items={report.reasons} />
            <TextList title="Weaknesses" items={report.weaknesses} />
            <TextList title="Recommendations" items={report.recommendations} />
          </div>
        </Disclosure>
      )}
    </SectionCard>
  );
};
