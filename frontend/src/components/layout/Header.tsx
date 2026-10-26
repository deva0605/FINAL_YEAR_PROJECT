import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2, Menu, Play, Presentation, Search } from 'lucide-react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { checkHealth } from '../../api/workflow';
import { useRunAnalysis } from '../../hooks/useRunAnalysis';
import { cn } from '../../utils/cn';
import { ExportPdfButton } from '../common/ExportPdfButton';
import { failureOf } from '../../utils/workflow';

// Static placeholder figures from the original design; they are NOT fetched from any market-data source.
const TICKER_DATA = [
  { symbol: 'SENSEX', value: '79,842.10', change: '+0.84%', isGain: true },
  { symbol: 'NIFTY 50', value: '24,250.20', change: '+1.10%', isGain: true },
  { symbol: 'BANKNIFTY', value: '52,430.15', change: '+0.85%', isGain: true },
  { symbol: 'GOLD', value: '₹72,450', change: '-0.24%', isGain: false },
  { symbol: 'CRUDE OIL', value: '₹6,890', change: '+1.42%', isGain: true },
  { symbol: 'USD/INR', value: '83.92', change: '-0.08%', isGain: false },
  { symbol: 'S&P 500', value: '5,648.40', change: '+0.45%', isGain: true },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Intelligence Hub',
  '/research': 'Deep Research',
  '/strategies': 'Alpha Factor Lab',
  '/risk': 'VaR Risk Models',
  '/decision': 'Decision Engine',
  '/report': 'Audit Trails',
  '/history': 'Research History',
  '/settings': 'Engine Settings',
};

type Connection = 'checking' | 'online' | 'offline';

/** Real reachability of the backend (GET /), re-checked every 30 seconds. */
function useBackendStatus(): Connection {
  const [status, setStatus] = useState<Connection>('checking');
  useEffect(() => {
    let cancelled = false;
    const check = () =>
      checkHealth()
        .then(() => !cancelled && setStatus('online'))
        .catch(() => !cancelled && setStatus('offline'));
    check();
    const timer = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  return status;
}

interface HeaderProps {
  onOpenNav: () => void;
}

export function Header({ onOpenNav }: HeaderProps) {
  const { query, setQuery, loading, workflowState, isPresentationMode, setPresentationMode } = useWorkflowStore();
  const { pathname } = useLocation();
  const runAnalysis = useRunAnalysis();
  const connection = useBackendStatus();

  // The dashboard shows its own large composer while it is empty, so the compact one is only needed elsewhere.
  const heroVisible = pathname === '/' && !loading && (!workflowState || failureOf(workflowState) !== null);
  const title = PAGE_TITLES[pathname] ?? 'FinAI Cloud';

  // Ctrl/Cmd+K focuses the research input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('research-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const connectionLabel =
    connection === 'online' ? 'Backend connected' : connection === 'offline' ? 'Backend unreachable' : 'Checking backend…';

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <button type="button" onClick={onOpenNav} className="btn-ghost -ml-2 p-2 lg:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>

        <h2 className="hidden whitespace-nowrap text-sm font-semibold text-ink sm:block">{title}</h2>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          {!heroVisible && (
            <form
              role="search"
              className="flex w-full max-w-md items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                runAnalysis();
              }}
            >
              <label htmlFor="research-input" className="sr-only">
                Company or ticker to research
              </label>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <input
                  id="research-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loading}
                  autoComplete="off"
                  placeholder="Company or ticker, e.g. RELIANCE.NS"
                  className="w-full rounded-lg border border-line bg-canvas py-1.5 pl-9 pr-3 text-sm text-ink placeholder-ink-muted transition-colors hover:border-line-strong focus:border-accent focus:bg-white disabled:opacity-60"
                />
              </div>
              <button type="submit" disabled={loading || !query.trim()} className="btn-primary whitespace-nowrap">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                <span className="hidden sm:inline">{loading ? 'Running…' : 'Run research'}</span>
                <span className="sr-only sm:hidden">Run research</span>
              </button>
            </form>
          )}

          {workflowState?.research_report && <ExportPdfButton compact />}

          <button
            type="button"
            onClick={() => setPresentationMode(!isPresentationMode)}
            aria-pressed={isPresentationMode}
            title="Show an animated agent walkthrough while the analysis runs"
            className={cn('btn-secondary hidden md:inline-flex', isPresentationMode && 'border-accent-line bg-accent-soft text-accent-ink hover:bg-accent-soft')}
          >
            <Presentation className="h-4 w-4" aria-hidden="true" />
            Present
          </button>

          <span
            role="status"
            title={connectionLabel}
            className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-ink-muted xl:flex"
          >
            <span
              className={cn('h-2 w-2 rounded-full', connection === 'online' ? 'bg-accent' : connection === 'offline' ? 'bg-danger' : 'bg-ink-faint animate-subtle-pulse')}
              aria-hidden="true"
            />
            {connectionLabel}
          </span>
        </div>
      </div>

      {/* Market strip: compact and secondary. Figures are static placeholders, and labelled as such. */}
      <div className="flex items-center gap-6 overflow-x-auto border-t border-line bg-canvas px-4 py-1 text-xs no-scrollbar sm:px-6" aria-label="Sample market figures">
        <span className="flex-shrink-0 rounded border border-line bg-white px-1.5 text-[11px] font-medium text-ink-muted" title="These figures are static placeholders, not live market data">
          Sample data
        </span>
        {TICKER_DATA.map((t) => (
          <div key={t.symbol} className="flex flex-shrink-0 items-center gap-1.5 tabular-nums">
            <span className="text-ink-muted">{t.symbol}</span>
            <span className="font-medium text-ink-soft">{t.value}</span>
            <span className={t.isGain ? 'text-accent-ink' : 'text-danger-ink'}>{t.change}</span>
          </div>
        ))}
      </div>
    </header>
  );
}
