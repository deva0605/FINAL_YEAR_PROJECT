import React from 'react';
import { History as HistoryIcon, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHistoryStore, HistoryEntry } from '../store/useHistoryStore';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { RecommendationBadge } from '../components/common/Badges';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';

export const History: React.FC = () => {
  const { entries, removeEntry, clearHistory } = useHistoryStore();
  const { setWorkflowState } = useWorkflowStore();
  const navigate = useNavigate();

  const handleOpen = (entry: HistoryEntry) => {
    setWorkflowState(entry.state);
    navigate('/');
  };

  if (entries.length === 0) {
    return (
      <>
        <PageHeader title="Analysis history" />
        <EmptyState icon={<HistoryIcon className="h-5 w-5" />} title="No history yet" description="Your past analyses will appear here." />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="Analysis history"
        description={`${entries.length} saved ${entries.length === 1 ? 'analysis' : 'analyses'}`}
        actions={
          <button type="button" onClick={clearHistory} className="btn-secondary text-danger-ink hover:text-danger-ink">
            Clear history
          </button>
        }
      />

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <li key={entry.id} className="card flex flex-col gap-3 p-4 transition-colors hover:border-line-strong">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-ink">{entry.company}</span>
              <span className="text-xs tabular-nums text-ink-muted">{new Date(entry.date).toLocaleDateString()}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <RecommendationBadge recommendation={entry.recommendation} />
              <ConfidenceBadge confidence={entry.confidence} />
            </div>

            <div className="mt-1 flex gap-2 border-t border-line pt-3">
              <button type="button" onClick={() => handleOpen(entry)} className="btn-secondary flex-1 py-1 text-xs">
                Open report
              </button>
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="btn-secondary px-2.5 py-1 hover:border-danger-line hover:bg-danger-soft hover:text-danger-ink"
                aria-label={`Delete ${entry.company} from history`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
