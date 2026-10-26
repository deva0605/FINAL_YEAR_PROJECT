import React, { useEffect, useRef, useState } from 'react';
import { Check, FileDown, Loader2, X } from 'lucide-react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { exportReportPdf } from '../../pdf/exportReportPdf';
import { getExportBlocker } from '../../pdf/reportModel';
import { cn } from '../../utils/cn';

interface ExportPdfButtonProps {
  className?: string;
  /** hide the text on narrow screens (the accessible name stays) */
  compact?: boolean;
}

/**
 * Exports the research report currently in memory (no new research run, no server round trip).
 * One export at a time: the button is disabled while the PDF is being built.
 */
export const ExportPdfButton: React.FC<ExportPdfButtonProps> = ({ className, compact }) => {
  const workflowState = useWorkflowStore((s) => s.workflowState);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  // a different report invalidates the previous outcome
  useEffect(() => {
    setError(null);
    setDone(null);
  }, [workflowState]);

  const blocker = getExportBlocker(workflowState);

  const onClick = async () => {
    if (running.current) return; // ignore repeated clicks while a PDF is being generated
    running.current = true;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const fileName = await exportReportPdf(workflowState);
      setDone(fileName);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(null), 4000);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'The PDF could not be generated.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={busy || !!blocker}
        aria-busy={busy}
        title={blocker ?? 'Download this research report as a PDF'}
        className={cn('btn-secondary', done && 'border-accent-line bg-accent-soft text-accent-ink hover:bg-accent-soft', className)}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : done ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <FileDown className="h-4 w-4" aria-hidden="true" />
        )}
        <span className={cn(compact && 'sr-only lg:not-sr-only')}>{busy ? 'Preparing PDF…' : done ? 'PDF downloaded' : 'Export PDF'}</span>
      </button>

      <span className="sr-only" role="status" aria-live="polite">
        {busy ? 'Preparing the PDF.' : done ? `Downloaded ${done}.` : ''}
      </span>

      {error && (
        <div role="alert" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger-ink shadow-pop">
          <div className="flex items-start gap-2">
            <p className="flex-1">
              <span className="font-medium">PDF export failed.</span> {error}
            </p>
            <button type="button" onClick={() => setError(null)} className="rounded p-0.5 hover:bg-white/60" aria-label="Dismiss error">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
