import React from 'react';
import { WorkflowState } from '../../types';
import { SectionCard } from '../common/SectionCard';

interface ExplainabilityPanelProps {
  state: WorkflowState;
}

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({ state }) => {
  const { decision_report: dr } = state;

  return (
    <SectionCard title="Explainable AI" badge="Log">
      <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-[10px] leading-relaxed overflow-x-auto shadow-inner border border-slate-800 h-full max-h-[300px] overflow-y-auto custom-scrollbar">
        <div className="text-emerald-400 mb-2"># TERMINAL OUTPUT: DECISION ENGINE SYNTHESIS</div>
        <div className="mb-4">
          <span className="text-blue-400">INFO</span> [Core] Loading multi-agent state...<br/>
          <span className="text-blue-400">INFO</span> [Core] Integrating fundamentals, strategy, and risk vectors...<br/>
          <span className="text-emerald-400">SUCCESS</span> [Core] State synchronized.
        </div>

        <div className="text-amber-400 mb-1">## SYNTHESIS REASONING</div>
        <div className="whitespace-pre-wrap text-slate-400">
          {dr?.reasoning || 'No internal reasoning trace provided by the model.'}
        </div>
      </div>
    </SectionCard>
  );
};
