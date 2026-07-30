import { useWorkflowStore } from '../../store/useWorkflowStore';
import { executeWorkflow } from '../../api/workflow';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export function Header() {
  const { query, setQuery, setLoading, setWorkflowState, setError } = useWorkflowStore();
  const navigate = useNavigate();

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runAnalysis(query);
    }
  };

  const runAnalysis = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    // Navigate to dashboard if not already there, where the workflow UI is shown
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
    <header className="fixed top-0 left-72 right-0 bg-surface-container-lowest z-40 shadow-sm">
      <div className="h-16 px-8 flex items-center justify-center gap-4">
        <div className="flex-1 max-w-2xl relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input
            className="w-full h-11 pl-12 pr-24 bg-surface-container rounded-full border-none focus:ring-2 focus:ring-primary/20 text-body-md transition-all outline-none"
            placeholder="Enter a company or investment idea to run multi-agent research"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKey}
          />
          <button
            onClick={() => runAnalysis(query)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-full hover:opacity-90 transition-opacity"
          >
            ANALYZE
          </button>
        </div>
      </div>

      <div className="h-10 bg-surface-container-low border-t border-outline-variant overflow-hidden flex items-center">
        <div className="whitespace-nowrap flex items-center gap-8 px-8 animate-marquee text-label-md font-medium text-on-surface-variant">
          <span className="flex items-center gap-2">SENSEX <span className="text-secondary font-bold">77,654.60 (+1.16%)</span></span>
          <span className="flex items-center gap-2">NIFTY 50 <span className="text-secondary font-bold">24,250.20 (+1.10%)</span></span>
          <span className="flex items-center gap-2">BANKNIFTY <span className="text-secondary font-bold">52,430.15 (+0.85%)</span></span>
          <span className="flex items-center gap-2 uppercase">Gold <span className="text-tertiary font-bold">72,450 (-0.24%)</span></span>
          <span className="flex items-center gap-2 uppercase">Crude Oil <span className="text-secondary font-bold">6,890 (+1.42%)</span></span>
        </div>
      </div>
    </header>
  );
}
