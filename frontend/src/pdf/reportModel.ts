// Turns the research response (WorkflowState) into the display model the PDF is drawn from.
//
// Everything here is formatting: values, currencies, labels and statuses come from the response as returned.
// Nothing is recalculated, defaulted to zero, or filled with sample data. A field the response does not contain
// stays `undefined` and is printed as "Not available", which is different from a genuine 0.
import { ResearchReport, WorkflowState } from '../types';
import { formatLargeAmount, formatMoney } from '../utils/currency';
import { exchangeFor, formatPercent, formatSeconds, friendlyWorkflowError } from '../utils/format';
import { buildExecutionSteps } from '../utils/execution';
import { describeSections, summarizeSources } from '../utils/generation';
import { toneForRisk } from '../components/common/tone';
import { PdfTone } from './theme';

export interface Row {
  label: string;
  value?: string; // undefined = not available
  note?: string;
  tone?: PdfTone;
}

export interface ExecutionRow {
  label: string;
  detail: string;
  status: string;
  statusTone: PdfTone;
  source: string;
}

export interface PdfReportModel {
  fileName: string;
  generatedAt: string;
  ticker: string;
  company: string;
  identity: string[]; // ticker, exchange, sector, industry

  price?: string;
  priceCurrency: string;
  recommendation?: string;
  recommendationTone: PdfTone;
  confidence?: number; // 0..1
  summaryRows: Row[];
  statusRows: Row[];
  sourceNotice: { tone: PdfTone; title: string; body: string };
  executiveSummary?: string;
  partialRunWarning?: string;

  market: {
    rows: Row[];
    range?: { low: string; high: string; position: number };
    rsi?: number;
    priceVsAverages: Row[];
    sentiment?: string;
    summary?: string;
  };

  fundamentals: { rows: Row[]; summary?: string; website?: string };
  news: { title: string; date?: string; url?: string }[];
  sources: string[];
  dataNotes: string[];

  strategy?: {
    bull?: string;
    bear?: string;
    approach?: string;
    levels: Row[];
    detail: Row[];
    reasoning?: string;
    catalysts: string[];
  };
  risk?: {
    rows: Row[];
    rating?: string;
    ratingTone: PdfTone;
    score?: number;
    reasons: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  explain: { reasoning?: string; evidence: string[]; nextSteps: string[] };

  execution: {
    rows: ExecutionRow[];
    totals: Row[];
    errors: string[];
    retrieval: Row[];
  };
  limitations: string[];
}

// ---------------------------------------------------------------------------------------------------------------

function stamp(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
}

function num(value: number | null | undefined, digits: number): string | undefined {
  return value == null || !Number.isFinite(value) ? undefined : value.toFixed(digits);
}

function money(value: number | null | undefined, currency?: string | null): string | undefined {
  return value == null ? undefined : formatMoney(value, currency);
}

function clean(list?: (string | null | undefined)[]): string[] {
  return (list || []).filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
}

function recommendationTone(rec?: string): PdfTone {
  const r = (rec || '').toUpperCase();
  if (!r) return 'neutral';
  if (r.includes('BUY')) return 'accent';
  if (r.includes('SELL')) return 'danger';
  return 'caution';
}

function sentimentTone(sentiment?: string): PdfTone {
  const s = (sentiment || '').toLowerCase();
  return s === 'bullish' ? 'accent' : s === 'bearish' ? 'danger' : 'neutral';
}

function relation(price?: number | null, average?: number | null): string | undefined {
  if (price == null || average == null) return undefined;
  return price > average ? 'Above' : price < average ? 'Below' : 'At';
}

/** The overall score appears only inside the decision text; read it back verbatim rather than recomputing it. */
export function extractOverallScore(...texts: (string | undefined)[]): string | undefined {
  for (const text of texts) {
    const match = text?.match(/Overall (?:Investment )?Score(?: is|:)?\s*(\d+(?:\.\d+)?)\s*\/\s*100/i);
    if (match) return `${match[1]} / 100`;
  }
  return undefined;
}

/** Why a report cannot be exported (null when it can). Partial runs are exportable and are labelled as such. */
export function getExportBlocker(state?: WorkflowState | null): string | null {
  if (!state) return 'There is no research report to export. Run a research first.';
  const rr = state.research_report;
  if (!rr) return 'The research did not produce a report, so there is nothing to export.';
  if (!(rr.ticker || rr.symbol || rr.company)) return 'The report does not identify a company or ticker, so it cannot be exported.';
  return null;
}

export function buildFileName(state: WorkflowState, now: Date = new Date()): string {
  const rr = state.research_report;
  const ticker = (rr?.ticker || rr?.symbol || rr?.company || 'report').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'report';
  const reportDate = state.metadata?.completed_at ? new Date(state.metadata.completed_at) : now;
  const date = Number.isNaN(reportDate.getTime()) ? now : reportDate;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `FinAI_${ticker}_${yyyy}-${mm}-${dd}.pdf`;
}

function valuationLabel(pe?: number | null): string | undefined {
  if (pe == null) return undefined;
  if (pe < 0) return 'Loss-making';
  if (pe < 15) return 'Undervalued';
  if (pe < 30) return 'Fair value';
  if (pe < 50) return 'Stretched';
  return 'Overvalued';
}

const TIER_LABELS = { mega: 'Mega-cap', large: 'Large-cap', mid: 'Mid-cap', small: 'Small-cap' } as const;

function marketRows(rr: ResearchReport) {
  const ti = rr.technical_indicators;
  const price = rr.current_price ?? ti?.latest_close;
  const high = rr.high_52_week ?? ti?.high_52_week;
  const low = rr.low_52_week ?? ti?.low_52_week;
  const rsi = rr.rsi ?? ti?.rsi_14;
  const ma20 = rr.moving_averages?.['20d'] ?? ti?.moving_average_20;
  const ma50 = rr.moving_averages?.['50d'] ?? ti?.moving_average_50;
  const cur = rr.currency;

  const rows: Row[] = [
    { label: 'Current price', value: money(price, cur) },
    { label: '52-week high', value: money(high, cur) },
    { label: '52-week low', value: money(low, cur) },
    { label: 'RSI (14)', value: num(rsi, 1), note: rsi == null ? undefined : rsi < 30 ? 'Oversold (below 30)' : rsi > 70 ? 'Overbought (above 70)' : 'Neutral (30 to 70)' },
    { label: '20-day moving average', value: money(ma20, cur) },
    { label: '50-day moving average', value: money(ma50, cur) },
  ];

  const priceVsAverages: Row[] = [];
  const vs20 = relation(price, ma20);
  const vs50 = relation(price, ma50);
  if (vs20) priceVsAverages.push({ label: 'Price vs 20-day average', value: vs20, note: `${money(price, cur)} against ${money(ma20, cur)}` });
  if (vs50) priceVsAverages.push({ label: 'Price vs 50-day average', value: vs50, note: `${money(price, cur)} against ${money(ma50, cur)}` });

  let range: PdfReportModel['market']['range'];
  if (price != null && high != null && low != null && high - low > 0) {
    range = { low: formatMoney(low, cur), high: formatMoney(high, cur), position: Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100)) };
  }
  return { rows, priceVsAverages, range, rsi: rsi ?? undefined };
}

export function buildReportModel(state: WorkflowState, now: Date = new Date()): PdfReportModel {
  const rr = state.research_report as ResearchReport;
  const sr = state.strategy_report;
  const risk = state.risk_report;
  const dr = state.decision_report;
  const meta = state.metadata;
  const cur = rr.currency;

  const ticker = rr.ticker || rr.symbol || '';
  const company = rr.company || ticker || 'Unnamed company';
  const exchange = exchangeFor(ticker);
  const failed = meta?.current_step === 'failed' || (meta?.errors?.length ?? 0) > 0;

  // ---- where the text came from (Gemini or the rule-based fallback), straight from the backend metadata
  const sources = summarizeSources(state);
  let sourceNotice: PdfReportModel['sourceNotice'];
  if (sources.mode === 'fallback') {
    sourceNotice = {
      tone: 'caution',
      title: 'Rule-based analysis (not generated by Gemini)',
      body: `Produced by deterministic rules, not by Gemini: ${describeSections(sources.fallback)} (${sources.reasons.join('; ')}).`,
    };
  } else if (sources.mode === 'mixed') {
    sourceNotice = {
      tone: 'caution',
      title: `Partly rule-based analysis (${sources.fallback.length} of ${sources.fallback.length + sources.llm.length} sections)`,
      body: `${sources.fallback.map((s) => `${s.label} (${s.reasonText})`).join('; ')} used the deterministic fallback. The remaining sections were generated with Gemini${sources.models.length ? ` (${sources.models.join(', ')})` : ''}.`,
    };
  } else if (sources.mode === 'llm') {
    sourceNotice = {
      tone: 'neutral',
      title: 'Generated with Gemini',
      body: `Generated with Gemini${sources.models.length ? ` (${sources.models.join(', ')})` : ''}: ${describeSections(sources.llm)}.`,
    };
  } else {
    sourceNotice = {
      tone: 'neutral',
      title: 'Analysis source not recorded',
      body: 'This report does not record whether its text came from Gemini or from the rule-based fallback.',
    };
  }

  // ---- executive summary
  const overallScore = extractOverallScore(dr?.reasoning, dr?.overall_summary);
  const summaryRows: Row[] = [
    { label: 'Investment horizon', value: sr?.time_horizon || dr?.investment_horizon || undefined },
    { label: 'Overall risk', value: risk?.overall_risk_rating || risk?.overall_risk || undefined, tone: toneForRisk(risk?.overall_risk_rating || risk?.overall_risk || '') },
    { label: 'Risk score', value: num(risk?.risk_score, 0) ? `${num(risk?.risk_score, 0)} / 100` : undefined, note: risk?.risk_score != null ? 'Higher means more risk' : undefined },
    { label: 'Overall investment score', value: overallScore, note: overallScore ? 'As stated in the decision text' : undefined },
    { label: 'Sentiment', value: rr.sentiment || undefined, tone: sentimentTone(rr.sentiment) },
  ];

  const dataAsOf = stamp(rr.market_data_as_of);
  const statusRows: Row[] = [
    { label: 'Analysis completed', value: stamp(meta?.completed_at) },
    { label: 'Market data as of', value: dataAsOf },
    { label: 'Market data source', value: rr.market_data_source || undefined },
    { label: 'Data freshness', value: rr.market_data_freshness || undefined, note: rr.market_data_freshness ? 'As reported by the data source' : undefined },
    {
      label: 'Currency',
      value: cur ? cur.toUpperCase() : 'Unverified',
      note: cur ? (rr.currency_source ? `Verified via ${rr.currency_source}` : undefined) : 'No data source confirmed the currency; amounts are shown with the ¤ sign',
      tone: cur ? undefined : 'caution',
    },
  ];

  // ---- market / technical
  const mk = marketRows(rr);

  // ---- fundamentals
  const fund = rr.fundamentals;
  const pe = rr.pe_ratio ?? fund?.pe_ratio;
  const marketCap = rr.market_cap ?? fund?.market_cap;
  const pb = fund?.price_to_book;
  const beta = fund?.beta;
  const dividend = fund?.dividend_yield;
  const NOT_PROVIDED = 'Not provided in this report';
  const fundRows: Row[] = [
    {
      label: 'Market capitalisation',
      value: marketCap != null ? formatLargeAmount(marketCap, cur) : undefined,
      note: marketCap == null ? undefined : rr.market_cap_tier ? TIER_LABELS[rr.market_cap_tier] : 'Size tier not classified',
    },
    { label: 'P/E ratio', value: num(pe, 1), note: valuationLabel(pe) },
    { label: 'Price to book', value: num(pb, 2), note: pb == null ? NOT_PROVIDED : undefined },
    { label: 'Beta', value: num(beta, 2), note: beta == null ? NOT_PROVIDED : beta > 1.5 ? 'High volatility' : beta < 0.5 ? 'Defensive' : 'Moderate' },
    { label: 'Dividend yield', value: dividend == null ? undefined : `${(dividend * 100).toFixed(2)}%`, note: dividend == null ? NOT_PROVIDED : undefined },
  ];
  if (rr.eps != null) fundRows.push({ label: 'Earnings per share', value: formatMoney(rr.eps, cur) });
  if (rr.revenue != null) fundRows.push({ label: 'Revenue', value: formatLargeAmount(rr.revenue, cur) });

  const news = (rr.latest_news || []).filter((n) => n && n.title).map((n) => ({ title: n.title, date: n.publish_date || undefined, url: n.url || undefined }));
  const dataNotes = clean(rr.market_data_warnings);

  // ---- strategy and risk
  const strategy: PdfReportModel['strategy'] = sr
    ? {
        bull: sr.bull_thesis || undefined,
        bear: sr.bear_thesis || undefined,
        approach: sr.suggested_strategy || undefined,
        levels: [
          { label: 'Entry zone', value: sr.entry_zone || undefined },
          { label: 'Stop-loss', value: sr.exit_zone || undefined },
          { label: 'Target', value: sr.target || undefined },
        ],
        detail: [
          { label: 'Time horizon', value: sr.time_horizon || undefined },
          { label: 'Strategy confidence', value: formatPercent(sr.confidence) },
        ],
        reasoning: sr.reasoning || undefined,
        catalysts: clean(sr.catalysts),
      }
    : undefined;

  const riskRow = (label: string, value?: string): Row => ({ label, value: value || undefined, tone: value ? toneForRisk(value) : undefined });
  const riskModel: PdfReportModel['risk'] = risk
    ? {
        rows: [
          riskRow('Volatility', risk.volatility),
          riskRow('Liquidity', risk.liquidity),
          riskRow('Valuation risk', risk.valuation),
          riskRow('Financial risk', risk.financial_risk),
          riskRow('News risk', risk.news_risk),
          riskRow('Macro risk', risk.macro_risk),
        ],
        rating: risk.overall_risk_rating || risk.overall_risk || undefined,
        ratingTone: toneForRisk(risk.overall_risk_rating || risk.overall_risk || ''),
        score: risk.risk_score ?? undefined,
        reasons: clean(risk.reasons),
        weaknesses: clean(risk.weaknesses),
        recommendations: clean(risk.recommendations),
      }
    : undefined;

  // ---- execution and transparency
  const rows: ExecutionRow[] = buildExecutionSteps(state).map((step) => {
    const src = step.source;
    const source =
      step.status !== 'done' ? '—' : src?.kind === 'llm' ? `Gemini${src.model ? ` (${src.model})` : ''}` : src?.kind === 'fallback' ? `Rule-based fallback: ${src.reasonText}` : 'Source not recorded';
    return {
      label: step.label,
      detail: step.detail,
      status: step.status === 'done' ? 'Completed' : step.status === 'failed' ? 'Failed' : 'Did not run',
      statusTone: step.status === 'failed' ? 'danger' : step.status === 'waiting' ? 'neutral' : src?.kind === 'fallback' ? 'caution' : 'accent',
      source,
    };
  });

  const totals: Row[] = [
    { label: 'Total run time', value: formatSeconds(meta?.execution_time_seconds) },
    { label: 'Started', value: stamp(meta?.started_at) },
    { label: 'Finished', value: stamp(meta?.completed_at) },
  ];
  const retrieval: Row[] = [
    { label: 'Market data source', value: rr.market_data_source || undefined },
    { label: 'Freshness', value: rr.market_data_freshness || undefined },
    { label: 'Data as of', value: dataAsOf },
    { label: 'Data warnings', value: String(dataNotes.length), note: dataNotes.length ? 'Listed in the data notes section' : 'None raised' },
    { label: 'News headlines retrieved', value: String(news.length) },
  ];

  // ---- limitations: only facts that follow from what the response does and does not contain
  const limitations: string[] = [
    'Per-agent latency is not reported by the backend, so only the total run time is shown.',
    'The research response contains no price history, so the report includes indicator bars built from the summary metrics but no price chart.',
    'The response does not include a daily price change.',
  ];
  const missingFundamentals = [pb == null && 'price-to-book', beta == null && 'beta', dividend == null && 'dividend yield'].filter(Boolean);
  if (missingFundamentals.length) limitations.push(`The research response did not provide: ${missingFundamentals.join(', ')}.`);
  if (!strategy) limitations.push('No strategy report is available for this run.');
  if (!riskModel) limitations.push('No risk report is available for this run.');
  if (!dr) limitations.push('No decision report is available for this run, so there is no recommendation.');

  return {
    fileName: buildFileName(state, now),
    generatedAt: stamp(now.toISOString()) || now.toISOString(),
    ticker,
    company,
    identity: [ticker, exchange, rr.sector || undefined, rr.industry || undefined].filter((p): p is string => !!p),
    price: money(rr.current_price ?? rr.technical_indicators?.latest_close, cur),
    priceCurrency: cur ? cur.toUpperCase() : rr.current_price == null ? '' : 'currency unverified',
    recommendation: dr?.recommendation || undefined,
    recommendationTone: recommendationTone(dr?.recommendation),
    confidence: dr?.confidence ?? undefined,
    summaryRows,
    statusRows,
    sourceNotice,
    executiveSummary: dr?.overall_summary || undefined,
    partialRunWarning: failed ? 'This run did not finish cleanly, so parts of the report may be missing. See "Execution and transparency".' : undefined,
    market: { rows: mk.rows, range: mk.range, rsi: mk.rsi, priceVsAverages: mk.priceVsAverages, sentiment: rr.sentiment || undefined, summary: rr.technical_summary || undefined },
    fundamentals: { rows: fundRows, summary: rr.fundamental_summary || fund?.long_business_summary || undefined, website: fund?.website || undefined },
    news,
    sources: clean(rr.sources),
    dataNotes,
    strategy,
    risk: riskModel,
    explain: { reasoning: dr?.reasoning || undefined, evidence: clean(dr?.supporting_evidence), nextSteps: clean(dr?.next_steps) },
    execution: { rows, totals, errors: clean(meta?.errors).map(friendlyWorkflowError), retrieval },
    limitations,
  };
}
