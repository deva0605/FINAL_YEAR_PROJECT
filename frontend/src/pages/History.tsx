import React, { useEffect } from 'react';
import { useHistoryStore } from '../store/useHistoryStore';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { useNavigate } from 'react-router-dom';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';

export const History: React.FC = () => {
  const { entries, removeEntry, clearHistory } = useHistoryStore();
  const { setWorkflowState } = useWorkflowStore();
  const navigate = useNavigate();

  // On mount, could save current workflow state to history if not there, but backend handles this differently.
  // For now, History just displays saved entries. (If we implemented auto-saving in useWorkflowStore).

  const handleOpen = (entry: any) => {
    setWorkflowState(entry.state);
    navigate('/');
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">history</span>
        <h2 className="text-headline-sm font-bold">No History</h2>
        <p>Your past analyses will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-display-sm font-bold text-on-surface">Analysis History</h2>
        <button 
          onClick={clearHistory}
          className="text-error hover:bg-error/10 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        >
          Clear History
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map((entry) => (
          <div key={entry.id} className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/20 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="font-bold text-title-md">{entry.company}</div>
              <div className="text-xs text-on-surface-variant">{new Date(entry.date).toLocaleDateString()}</div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{entry.recommendation}</span>
              <ConfidenceBadge confidence={entry.confidence} />
            </div>

            <div className="mt-auto pt-4 flex gap-2">
              <button 
                onClick={() => handleOpen(entry)}
                className="flex-1 bg-primary text-on-primary py-1.5 rounded text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Open Report
              </button>
              <button 
                onClick={() => removeEntry(entry.id)}
                className="px-3 bg-surface-variant text-on-surface-variant rounded hover:bg-error/10 hover:text-error transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
