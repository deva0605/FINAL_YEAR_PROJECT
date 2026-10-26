import React from 'react';
import { WorkflowState } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { AgentStatus, StatusChip } from '../common/StatusChip';
import { Notice } from '../common/Notice';
import { AgentSource } from '../../utils/generation';
import { buildExecutionSteps } from '../../utils/execution';
import { formatDateTime, formatSeconds, friendlyWorkflowError } from '../../utils/format';
import { cn } from '../../utils/cn';

interface WorkflowTimelineProps {
  state: WorkflowState;
}

function sourceLine(source: AgentSource | undefined, showReason: boolean): string | undefined {
  if (!source) return undefined;
  if (source.kind === 'llm') return `Generated with Gemini${source.model ? ` (${source.model})` : ''}`;
  if (source.kind === 'fallback') return showReason ? `Rule-based fallback: ${source.reasonText}` : 'Rule-based fallback';
  return 'Analysis source not recorded';
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ state }) => {
  const meta = state.metadata;
  const errors = meta?.errors || [];
  const rows = buildExecutionSteps(state);
  const execTime = formatSeconds(meta?.execution_time_seconds);
  const started = formatDateTime(meta?.started_at);
  const finished = formatDateTime(meta?.completed_at);

  // when every fallback has the same cause, say it once under the list instead of on every row
  const fallbackReasons = Array.from(new Set(rows.filter((r) => r.source?.kind === 'fallback').map((r) => r.source?.reasonText)));
  const sharedReason = fallbackReasons.length === 1 ? fallbackReasons[0] : undefined;

  return (
    <SectionCard id="execution" title="Execution graph" description="Which agents ran, in order, and how each produced its output.">
      <ol className="relative space-y-4 border-l border-line pl-5">
        {rows.map((row) => {
          const chipStatus: AgentStatus =
            row.status === 'failed' ? 'error' : row.status === 'waiting' ? 'waiting' : row.source?.kind === 'fallback' ? 'fallback' : 'completed';
          const line = row.status === 'done' ? sourceLine(row.source, !sharedReason) : undefined;
          return (
            <li key={row.key} className="relative">
              <span
                className={cn(
                  'absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white',
                  row.status === 'failed' ? 'bg-danger' : row.status === 'waiting' ? 'bg-ink-faint' : row.source?.kind === 'fallback' ? 'bg-caution' : 'bg-accent',
                )}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{row.label}</span>
                <StatusChip status={chipStatus} />
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">{row.detail}</p>
              {line && <p className={cn('mt-0.5 text-xs', row.source?.kind === 'fallback' ? 'text-caution-ink' : 'text-ink-muted')}>{line}</p>}
            </li>
          );
        })}
      </ol>

      {sharedReason && <p className="mt-4 text-xs text-caution-ink">Why rule-based: {sharedReason}.</p>}

      {errors.length > 0 && (
        <Notice tone="danger" urgent title="The workflow reported a problem" className="mt-4">
          <ul className="list-inside list-disc">
            {errors.map((e, i) => (
              <li key={i}>{friendlyWorkflowError(e)}</li>
            ))}
          </ul>
        </Notice>
      )}

      {(execTime || started || finished) && (
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 text-xs">
          {execTime && (
            <>
              <dt className="text-ink-muted">Total time</dt>
              <dd className="text-right font-medium tabular-nums text-ink">{execTime}</dd>
            </>
          )}
          {started && (
            <>
              <dt className="text-ink-muted">Started</dt>
              <dd className="text-right tabular-nums text-ink-soft">{started}</dd>
            </>
          )}
          {finished && (
            <>
              <dt className="text-ink-muted">Finished</dt>
              <dd className="text-right tabular-nums text-ink-soft">{finished}</dd>
            </>
          )}
        </dl>
      )}
      <p className="mt-3 text-xs text-ink-muted">The backend reports total time only, so per-agent latency is not shown.</p>
    </SectionCard>
  );
};
