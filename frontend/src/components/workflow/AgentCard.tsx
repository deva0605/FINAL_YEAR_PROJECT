import React from 'react';
import { StatusChip } from '../common/StatusChip';

interface AgentCardProps {
  name: string;
  status: 'waiting' | 'running' | 'completed' | 'error';
  tasks: string[];
}

export const AgentCard: React.FC<AgentCardProps> = ({ name, status, tasks }) => {
  return (
    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-on-surface">{name}</div>
        <StatusChip status={status} />
      </div>
      <div className="text-xs text-on-surface-variant flex flex-col gap-1.5 flex-1">
        {tasks.map((task, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            {task}
          </div>
        ))}
      </div>
    </div>
  );
};
