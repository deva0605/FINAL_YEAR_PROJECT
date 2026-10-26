import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { executeWorkflow } from '../api/workflow';
import { useWorkflowStore } from '../store/useWorkflowStore';

/**
 * Starts a research run exactly as the header Run button always has (navigate home, clear the previous
 * result, call POST /workflow/execute, store the result or the error), so the header and the dashboard
 * composer share one code path. Ignores empty input and a run that is already in progress.
 */
export function useRunAnalysis() {
  const navigate = useNavigate();

  return useCallback(
    async (text?: string) => {
      const store = useWorkflowStore.getState();
      const searchQuery = (text ?? store.query).trim();
      if (!searchQuery || store.loading) return;

      navigate('/');
      store.setLoading(true);
      store.setError(null);
      store.setWorkflowState(null);
      try {
        const result = await executeWorkflow(searchQuery);
        useWorkflowStore.getState().setWorkflowState(result);
        useWorkflowStore.getState().updateCounters(result);
      } catch (err) {
        console.error('Backend Error:', err);
        useWorkflowStore.getState().setError(err instanceof Error && err.message ? err.message : 'Failed to run analysis.');
      } finally {
        useWorkflowStore.getState().setLoading(false);
      }
    },
    [navigate],
  );
}
