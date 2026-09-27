import { create } from 'zustand';
import { WorkflowState } from '../types';

interface WorkflowStore {
  query: string;
  setQuery: (query: string) => void;
  workflowState: WorkflowState | null;
  setWorkflowState: (state: WorkflowState | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  counters: { companies: number; strategies: number; reports: number; avgConfidence: number };
  updateCounters: (state: WorkflowState) => void;
  reset: () => void;
  isPresentationMode: boolean;
  setPresentationMode: (val: boolean) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  query: '',
  setQuery: (query) => set({ query }),
  workflowState: null,
  setWorkflowState: (state) => set({ workflowState: state }),
  loading: false,
  setLoading: (loading) => set({ loading }),
  error: null,
  setError: (error) => set({ error }),
  counters: { companies: 0, strategies: 0, reports: 0, avgConfidence: 0 },
  updateCounters: (state) => set((prev) => {
    const newReports = prev.counters.reports + 1;
    const newConf = state.decision_report?.confidence 
      ? Math.round(((prev.counters.avgConfidence * prev.counters.reports) + state.decision_report.confidence) / newReports * 100) / 100
      : prev.counters.avgConfidence;
    return {
      counters: {
        companies: prev.counters.companies + 1,
        strategies: prev.counters.strategies + (state.strategy_report ? 1 : 0),
        reports: newReports,
        avgConfidence: newConf,
      }
    };
  }),
  reset: () => set({ workflowState: null, error: null }),
  isPresentationMode: localStorage.getItem('presentationMode') !== 'false',
  setPresentationMode: (val) => {
    localStorage.setItem('presentationMode', String(val));
    set({ isPresentationMode: val });
  }
}));
