import { WorkflowState } from '../types';

/**
 * The backend answers HTTP 200 even when the workflow could not run (for example an unknown ticker), so a
 * failure is read from the state itself. Returns the recorded errors, or null when the run produced a report.
 */
export function failureOf(state: WorkflowState | null | undefined): string[] | null {
  if (!state) return null;
  if (state.research_report) return null; // partial results are shown, with the errors listed alongside
  const failed = state.metadata?.current_step === 'failed';
  const errors = state.metadata?.errors || [];
  if (!failed && errors.length === 0) return null;
  return errors.length > 0 ? errors : ['The analysis could not be completed.'];
}
