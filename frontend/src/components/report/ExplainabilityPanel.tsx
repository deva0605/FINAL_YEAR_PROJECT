import React from 'react';
import { WorkflowState } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { Disclosure } from '../common/Disclosure';

interface ExplainabilityPanelProps {
  state: WorkflowState;
}

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({ state }) => {
  const { decision_report: dr, research_report: rr } = state;
  const sources = rr?.sources || [];

  return (
    <SectionCard id="explainability" title="Explainable AI" description="How the decision was reached, and what it rests on.">
      <h3 className="mb-1.5 text-xs font-semibold text-ink">Decision reasoning</h3>
      <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-canvas px-4 py-3 text-sm leading-relaxed text-ink-soft">
        {dr?.reasoning || 'No reasoning trace was provided for this decision.'}
      </p>

      {sources.length > 0 && (
        <Disclosure label="Sources" count={sources.length} className="mt-4">
          <ul className="space-y-1.5">
            {sources.map((source, i) => (
              <li key={i} className="break-words text-xs text-ink-soft">
                {/^https?:\/\//.test(source) ? (
                  <a href={source} target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong underline-offset-2 hover:text-ink">
                    {source}
                  </a>
                ) : (
                  source
                )}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </SectionCard>
  );
};
