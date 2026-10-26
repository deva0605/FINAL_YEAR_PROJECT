// Turns the backend's `generation` metadata ({source: 'llm' | 'fallback', model, reason}) into plain language.
// Nothing here invents status: a report without `generation` is reported as "unknown", never as AI-generated.
import { GenerationInfo, WorkflowState } from '../types';

export type SourceKind = 'llm' | 'fallback' | 'unknown';

const REASON_TEXT: Record<string, string> = {
  no_api_key: 'no Gemini API key is configured',
  sdk_not_installed: 'the Gemini SDK is not installed',
  client_init_failed: 'the Gemini client could not start',
  rate_limited: 'Gemini is rate-limited right now',
  quota_exhausted: 'the Gemini quota is used up',
  transient_error: 'Gemini was temporarily unavailable',
  auth_error: 'Gemini rejected the API key',
  model_not_found: 'the configured Gemini model was not found',
  invalid_request: 'Gemini rejected the request',
  invalid_response: 'Gemini returned output that could not be used',
  unknown_error: 'Gemini failed unexpectedly',
  llm_unavailable: 'Gemini is unavailable',
};

export function describeReason(reason?: string | null): string {
  if (!reason) return 'Gemini is unavailable';
  return REASON_TEXT[reason] ?? `Gemini is unavailable (${reason})`;
}

export interface AgentSource {
  key: 'parser' | 'research' | 'strategy' | 'risk' | 'decision';
  label: string;
  kind: SourceKind;
  model?: string | null;
  reason?: string | null;
  reasonText?: string;
}

function toSource(key: AgentSource['key'], label: string, present: boolean, generation?: GenerationInfo | null): AgentSource | null {
  if (!present) return null;
  if (!generation) return { key, label, kind: 'unknown' };
  if (generation.source === 'llm') return { key, label, kind: 'llm', model: generation.model };
  return { key, label, kind: 'fallback', reason: generation.reason, reasonText: describeReason(generation.reason) };
}

/** Per-agent source info for everything the backend actually produced. */
export function collectSources(state?: WorkflowState | null): AgentSource[] {
  if (!state) return [];
  const parts = [
    toSource('parser', 'Query understanding', !!state.parsed_query, state.parsed_query?.generation),
    toSource('research', 'Research summaries', !!state.research_report, state.research_report?.generation),
    toSource('strategy', 'Strategy', !!state.strategy_report, state.strategy_report?.generation),
    toSource('risk', 'Risk assessment', !!state.risk_report, state.risk_report?.generation),
    toSource('decision', 'Decision', !!state.decision_report, state.decision_report?.generation),
  ];
  return parts.filter((p): p is AgentSource => p !== null);
}

/** "research summaries, strategy and decision": only the sections that actually exist in this report. */
export function describeSections(sources: AgentSource[]): string {
  const names = sources.map((s) => s.label.toLowerCase());
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export interface SourceSummary {
  mode: 'llm' | 'fallback' | 'mixed' | 'unknown';
  fallback: AgentSource[];
  llm: AgentSource[];
  models: string[];
  reasons: string[];
}

/** Overall picture for the report sections (the four report agents; the query parser is shown separately). */
export function summarizeSources(state?: WorkflowState | null): SourceSummary {
  const reports = collectSources(state).filter((s) => s.key !== 'parser');
  const fallback = reports.filter((s) => s.kind === 'fallback');
  const llm = reports.filter((s) => s.kind === 'llm');
  const unknown = reports.filter((s) => s.kind === 'unknown');
  let mode: SourceSummary['mode'] = 'unknown';
  if (reports.length > 0 && unknown.length === 0) {
    mode = fallback.length === 0 ? 'llm' : llm.length === 0 ? 'fallback' : 'mixed';
  }
  const models = Array.from(new Set(llm.map((s) => s.model).filter((m): m is string => !!m)));
  const reasons = Array.from(new Set(fallback.map((s) => s.reasonText).filter((r): r is string => !!r)));
  return { mode, fallback, llm, models, reasons };
}
