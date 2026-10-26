import React from 'react';
import { Loader2, Play, Search } from 'lucide-react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useRunAnalysis } from '../../hooks/useRunAnalysis';
import { PromptCard } from '../common/PromptCard';

const SUGGESTIONS = [
  { label: 'MSFT: AI Cloud & Margins', query: 'Analyze Microsoft (MSFT) for long-term growth and AI market positioning.' },
  { label: 'TSLA: FSD & Robotaxi Valuation', query: 'Assess Tesla (TSLA) volatility and current valuation risks.' },
  { label: 'RELIANCE: Retail & Jio IPO Impact', query: 'Evaluate Reliance Industries (RELIANCE.NS)' },
];

/** The primary research input: one field, one obvious action, and example queries that fill the field. */
export const ResearchComposer: React.FC = () => {
  const { query, setQuery, loading } = useWorkflowStore();
  const runAnalysis = useRunAnalysis();

  const fill = (text: string) => {
    setQuery(text);
    document.getElementById('research-input')?.focus();
  };

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          runAnalysis();
        }}
        className="rounded-2xl border border-line bg-white p-2 shadow-card transition-colors focus-within:border-accent"
      >
        <label htmlFor="research-input" className="sr-only">
          Company or ticker to research
        </label>
        <div className="flex items-center gap-2">
          <Search className="ml-3 h-5 w-5 flex-shrink-0 text-ink-muted" aria-hidden="true" />
          <input
            id="research-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            autoComplete="off"
            placeholder="Company or ticker, e.g. Evaluate Reliance Industries (RELIANCE.NS)"
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink placeholder-ink-muted outline-none focus-visible:outline-none disabled:opacity-60"
          />
          <button type="submit" disabled={loading || !query.trim()} className="btn-primary px-4 py-2.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
            {loading ? 'Running…' : 'Run research'}
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-muted">Try:</span>
        {SUGGESTIONS.map((s) => (
          <PromptCard key={s.label} text={s.label} onClick={() => fill(s.query)} />
        ))}
      </div>
    </div>
  );
};
