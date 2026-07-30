import fetchWrapper from './client';
import { WorkflowState } from '../types';

export const executeWorkflow = async (symbol: string): Promise<WorkflowState> => {
  return fetchWrapper<WorkflowState>('/workflow/execute', {
    method: 'POST',
    body: JSON.stringify({ symbol }),
  });
};

export const checkHealth = async () => {
  return fetchWrapper<{ status: string }>('/');
};
