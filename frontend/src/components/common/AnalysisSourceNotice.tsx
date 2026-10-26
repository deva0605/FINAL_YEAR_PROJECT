import React, { useId, useState } from 'react';
import { ChevronDown, Info, Sparkles } from 'lucide-react';
import { WorkflowState } from '../../types';
import { describeSections, summarizeSources } from '../../utils/generation';
import { cn } from '../../utils/cn';
import { TONE_BADGE } from './tone';

interface Props {
  state: WorkflowState;
  className?: string;
}

/**
 * States, from the backend generation metadata, whether the report text came from Gemini or from the
 * deterministic rule-based fallback. Visible but quiet; it never presents fallback output as AI-generated.
 */
export const AnalysisSourceNotice: React.FC<Props> = ({ state, className }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const summary = summarizeSources(state);

  if (summary.mode === 'unknown') {
    return (
      <p className={cn('flex items-center gap-2 text-xs text-ink-muted', className)}>
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        The analysis source (Gemini or rule-based) was not recorded for this report.
      </p>
    );
  }

  if (summary.mode === 'llm') {
    return (
      <p className={cn('flex items-center gap-2 text-xs text-ink-muted', className)}>
        <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        Generated with Gemini{summary.models.length ? ` (${summary.models.join(', ')})` : ''}.
      </p>
    );
  }

  const total = summary.fallback.length + summary.llm.length;
  const headline =
    summary.mode === 'fallback'
      ? 'Rule-based analysis'
      : `Partly rule-based analysis (${summary.fallback.length} of ${total} sections)`;
  const body =
    summary.mode === 'fallback'
      ? `Produced by deterministic rules, not by Gemini: ${describeSections(summary.fallback)} (${summary.reasons.join('; ')}).`
      : `${summary.fallback.map((s) => s.label).join(', ')} used the deterministic fallback; the rest was generated with Gemini.`;

  return (
    <div className={cn('rounded-xl border px-4 py-2.5 text-sm', TONE_BADGE.caution, className)} role="status">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <span className="font-medium">{headline}.</span> <span className="opacity-90">{body}</span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium hover:bg-white/60"
        >
          Details
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </div>
      <ul id={panelId} hidden={!open} className="mt-2 space-y-1 border-t border-caution-line pt-2 text-xs">
        {[...summary.llm, ...summary.fallback].map((s) => (
          <li key={s.key} className="flex justify-between gap-4">
            <span>{s.label}</span>
            <span className="text-right opacity-90">{s.kind === 'llm' ? `Gemini${s.model ? ` (${s.model})` : ''}` : `Rule-based: ${s.reasonText}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
