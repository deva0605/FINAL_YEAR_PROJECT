import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ResearchReport, StrategyReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { DataMetric, MetricGrid } from '../common/DataMetric';
import { ExpandableText } from '../common/ExpandableText';
import { formatLargeAmount } from '../../utils/currency';

interface FundamentalsPanelProps {
  report?: ResearchReport;
  strategy?: StrategyReport;
}

export const FundamentalsPanel: React.FC<FundamentalsPanelProps> = ({ report }) => {
  const r = report;
  const fund = r?.fundamentals;
  const peRatio = r?.pe_ratio ?? fund?.pe_ratio;
  const marketCap = r?.market_cap ?? fund?.market_cap;
  const pb = fund?.price_to_book;
  const beta = fund?.beta;
  const summary = r?.fundamental_summary || fund?.long_business_summary;

  // The tier is computed by the backend (currency-aware); null means no verified thresholds for this currency.
  const TIER_LABELS = { mega: 'Mega-cap', large: 'Large-cap', mid: 'Mid-cap', small: 'Small-cap' } as const;
  function marketCapTier(cap?: number | null) {
    if (!cap) return undefined;
    return r?.market_cap_tier ? TIER_LABELS[r.market_cap_tier] : 'Size tier not classified';
  }

  function valuationLabel(pe?: number | null) {
    if (pe == null) return undefined;
    if (pe < 0) return 'Loss-making';
    if (pe < 15) return 'Undervalued';
    if (pe < 30) return 'Fair value';
    if (pe < 50) return 'Stretched';
    return 'Overvalued';
  }

  return (
    <SectionCard id="fundamentals" title="Fundamental analysis" description="Size, valuation and business profile.">
      <MetricGrid className="grid-cols-2 sm:grid-cols-4">
        <DataMetric label="Market cap" value={marketCap != null ? formatLargeAmount(marketCap, r?.currency) : undefined} sub={marketCapTier(marketCap)} />
        <DataMetric label="P/E ratio" value={peRatio?.toFixed(1)} sub={valuationLabel(peRatio)} />
        <DataMetric label="Price to book" value={pb?.toFixed(2)} />
        <DataMetric label="Beta" value={beta?.toFixed(2)} sub={beta != null ? (beta > 1.5 ? 'High volatility' : beta < 0.5 ? 'Defensive' : 'Moderate') : undefined} />
      </MetricGrid>

      {summary && (
        <div className="mt-5">
          <h3 className="mb-1.5 text-xs font-semibold text-ink">Summary</h3>
          <ExpandableText text={summary} threshold={420} />
        </div>
      )}

      {fund?.website && (
        <div className="mt-4">
          <a
            href={fund.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-ink-muted hover:text-ink"
          >
            Corporate website
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      )}
    </SectionCard>
  );
};
