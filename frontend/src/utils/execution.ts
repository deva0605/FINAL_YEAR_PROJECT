// Which agents ran, with what outcome and from which source. Shared by the dashboard Execution graph and the PDF
// export, so both always describe the same run in the same way.
import { WorkflowState } from '../types';
import { AgentSource, collectSources } from './generation';

export type StepStatus = 'done' | 'failed' | 'waiting';

export interface ExecutionStep {
  key: 'parser' | 'research' | 'strategy' | 'risk' | 'decision';
  label: string;
  detail: string;
  status: StepStatus;
  source?: AgentSource;
}

const AGENT_STEPS = [
  { key: 'research', label: 'Research agent', detail: 'Market data, fundamentals, news and technical indicators' },
  { key: 'strategy', label: 'Strategy agent', detail: 'Bull and bear cases, entry, stop and target' },
  { key: 'risk', label: 'Risk agent', detail: 'Volatility, liquidity, valuation and news risk' },
  { key: 'decision', label: 'Decision agent', detail: 'Combines the three reports into one recommendation' },
] as const;

/**
 * A step is done when the backend recorded it (or the whole workflow completed). After a failure, the first
 * step that is not done is the one that failed and the rest never ran.
 */
export function buildExecutionSteps(state: WorkflowState): ExecutionStep[] {
  const meta = state.metadata;
  const completed = meta?.completed_steps || [];
  const failed = meta?.current_step === 'failed';
  const sources = collectSources(state);

  let failureAssigned = false;
  const steps: ExecutionStep[] = [];
  if (state.parsed_query) {
    steps.push({
      key: 'parser',
      label: 'Query understanding',
      detail: 'Reads your request and finds the company or ticker',
      status: 'done',
      source: sources.find((s) => s.key === 'parser'),
    });
  }
  for (const step of AGENT_STEPS) {
    const done = completed.includes(step.key) || completed.includes('complete');
    let status: StepStatus = done ? 'done' : 'waiting';
    if (!done && failed && !failureAssigned) {
      failureAssigned = true;
      status = 'failed';
    }
    steps.push({ ...step, status, source: sources.find((s) => s.key === step.key) });
  }
  return steps;
}
