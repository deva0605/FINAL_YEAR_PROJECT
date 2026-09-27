import React from 'react';
import { useHistoryStore } from '../store/useHistoryStore';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { useNavigate } from 'react-router-dom';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { RecommendationBadge } from '../components/common/Badges';

export const History: React.FC = () => {
  const { entries, removeEntry, clearHistory } = useHistoryStore();
  const { setWorkflowState } = useWorkflowStore();
  const navigate = useNavigate();

  const handleOpen = (entry: any) => {
    setWorkflowState(entry.state);
    navigate('/');
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <h2 className="text-lg font-semibold text-slate-900">No History</h2>
        <p className="text-sm">Your past analyses will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Analysis History</h2>
        <button 
          onClick={clearHistory}
          className="text-xs font-medium text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-md transition-colors"
        >
          Clear History
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map((entry) => (
          <div key={entry.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3 group hover:border-slate-300 transition">
            <div className="flex justify-between items-start">
              <div className="font-bold text-slate-900">{entry.company}</div>
              <div className="text-[10px] font-mono text-slate-400">{new Date(entry.date).toLocaleDateString()}</div>
            </div>
            
            <div className="flex items-center gap-2">
              <RecommendationBadge recommendation={entry.recommendation} />
              <ConfidenceBadge confidence={entry.confidence} />
            </div>

            <div className="mt-2 pt-3 border-t border-slate-100 flex gap-2">
              <button 
                onClick={() => handleOpen(entry)}
                className="flex-1 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 py-1.5 rounded-md text-[11px] font-medium transition"
              >
                Open Report
              </button>
              <button 
                onClick={() => removeEntry(entry.id)}
                className="px-2.5 bg-white text-slate-400 border border-slate-200 rounded-md hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
