import { useWorkflowStore } from '../../store/useWorkflowStore';
import { executeWorkflow } from '../../api/workflow';
import { useNavigate } from 'react-router-dom';

const TICKER_DATA = [
  { symbol: 'SENSEX', value: '79,842.10', change: '+0.84%', isGain: true },
  { symbol: 'NIFTY 50', value: '24,250.20', change: '+1.10%', isGain: true },
  { symbol: 'BANKNIFTY', value: '52,430.15', change: '+0.85%', isGain: true },
  { symbol: 'GOLD', value: '₹72,450', change: '-0.24%', isGain: false },
  { symbol: 'CRUDE OIL', value: '₹6,890', change: '+1.42%', isGain: true },
  { symbol: 'USD/INR', value: '83.92', change: '-0.08%', isGain: false },
  { symbol: 'S&P 500', value: '5,648.40', change: '+0.45%', isGain: true },
];

export function Header() {
  const { query, setQuery, setLoading, setWorkflowState, setError } = useWorkflowStore();
  const navigate = useNavigate();

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') runAnalysis(query);
  };

  const runAnalysis = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    navigate('/');
    setLoading(true);
    setError(null);
    setWorkflowState(null);
    try {
      const result = await executeWorkflow(searchQuery.trim());
      setWorkflowState(result);
      useWorkflowStore.getState().updateCounters(result);
    } catch (err: any) {
      console.error("Backend Error:", err);
      setError(err.message || "Failed to run analysis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-surface-border">
      {/* Command bar */}
      <div className="px-6 py-2.5 flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="hover:text-slate-900 cursor-pointer">Workspaces</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">Multi-Agent Syntheses</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Stream
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="w-80 relative flex items-center">
            <span className="absolute left-3 text-slate-400 pointer-events-none">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
            </span>
            <input
              className="w-full pl-8 pr-16 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition font-sans"
              placeholder="Search ticker, thesis or analysis..."
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKey}
            />
            <kbd className="absolute right-2 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-xs">⌘K</kbd>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => runAnalysis(query)}
              className="px-2.5 py-1 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md border border-slate-900 transition flex items-center gap-1.5 shadow-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>Run Audit</span>
            </button>

            {/* Presentation Toggle */}
            <button
              onClick={() => useWorkflowStore.getState().setPresentationMode(!useWorkflowStore.getState().isPresentationMode)}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>Present</span>
            </button>

            {/* Notification bell */}
            <button className="relative p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full" />
            </button>
          </div>
        </div>
      </div>

      {/* Market ticker strip */}
      <div className="bg-slate-50/70 px-6 py-1.5 flex items-center overflow-x-auto no-scrollbar gap-8 text-[11px] font-mono border-b border-slate-200/60">
        {TICKER_DATA.map((t) => (
          <div key={t.symbol} className="flex items-center gap-2 flex-shrink-0">
            <span className="text-slate-500 font-semibold">{t.symbol}</span>
            <span className="text-slate-900 font-bold tabular-nums">{t.value}</span>
            <span className={`font-semibold tabular-nums ${t.isGain ? 'text-emerald-600' : 'text-rose-600'}`}>{t.change}</span>
          </div>
        ))}
      </div>
    </header>
  );
}
