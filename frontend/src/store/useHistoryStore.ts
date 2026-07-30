import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WorkflowState } from '../types';

export interface HistoryEntry {
  id: string;
  date: string;
  company: string;
  recommendation: string;
  confidence: number;
  state: WorkflowState;
}

interface HistoryStore {
  entries: HistoryEntry[];
  addEntry: (entry: HistoryEntry) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) => set((state) => ({ entries: [entry, ...state.entries] })),
      removeEntry: (id) => set((state) => ({ entries: state.entries.filter(e => e.id !== id) })),
      clearHistory: () => set({ entries: [] }),
    }),
    {
      name: 'market-intel-history',
    }
  )
);
