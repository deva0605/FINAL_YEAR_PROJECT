import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { PromptCard } from '../components/common/PromptCard';
import { AnimatedLoading } from '../components/workflow/AnimatedLoading';
import { ExecutiveSummary } from '../components/report/ExecutiveSummary';
import { MarketSnapshot } from '../components/report/MarketSnapshot';
import { TechnicalAnalysisPanel } from '../components/report/TechnicalAnalysisPanel';
import { FundamentalsPanel } from '../components/report/FundamentalsPanel';
import { NewsAnalysisPanel } from '../components/report/NewsAnalysisPanel';
import { StrategyPanel } from '../components/report/StrategyPanel';
import { RiskPanel } from '../components/report/RiskPanel';
import { DecisionPanel } from '../components/report/DecisionPanel';
import { ExplainabilityPanel } from '../components/report/ExplainabilityPanel';
import { WorkflowTimeline } from '../components/report/WorkflowTimeline';
import { cn } from '../utils/cn';

export const Dashboard: React.FC = () => {
  const { workflowState, loading, setQuery, query } = useWorkflowStore();

  const handlePromptClick = (text: string) => {
    setQuery(text);
    // Usually handled by header or a form submission, but this updates input for the user
  };

  const isRuleBased = workflowState?.strategy_report?.reasoning?.includes('Rule-Based') || 
                      workflowState?.decision_report?.reasoning?.includes('Rule-Based');

  return (
    <div className="flex flex-col gap-6 pb-12">
      {loading && !workflowState && (
        <section className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col min-h-[60vh] justify-center">
          <AnimatedLoading currentStep="research" />
        </section>
      )}

      {!loading && !workflowState && (
        <section className="bg-surface-container-lowest p-10 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col items-center justify-center text-center min-h-[70vh]">
          <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px]">query_stats</span>
          </div>
          <h1 className="text-display-md font-black text-on-surface mb-4 tracking-tight">Professional AI Investment Research</h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mb-10 leading-relaxed">
            Leverage a multi-agent AI architecture to analyze companies, evaluate technicals and fundamentals, process news sentiment, assess risks, and produce actionable investment decisions.
          </p>
          
          <div className="w-full max-w-4xl text-left">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary text-[20px]">lightbulb</span>
              <h2 className="text-title-md font-bold text-on-surface">Example Analysis Queries</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PromptCard text="Analyze Microsoft (MSFT) for long-term growth and AI market positioning." onClick={() => handlePromptClick('Analyze MSFT')} />
              <PromptCard text="Assess Tesla (TSLA) volatility and current valuation risks." onClick={() => handlePromptClick('Analyze TSLA')} />
              <PromptCard text="Evaluate Apple (AAPL) dividend yield and cash flow." onClick={() => handlePromptClick('Analyze AAPL')} />
              <PromptCard text="Examine Nvidia (NVDA) for short-term momentum trading." onClick={() => handlePromptClick('Analyze NVDA')} />
            </div>
          </div>
        </section>
      )}

      {workflowState && !loading && (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <ExecutiveSummary state={workflowState} query={query} />
          
          {workflowState.decision_report && (
            <DecisionPanel report={workflowState.decision_report} strategy={workflowState.strategy_report} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <MarketSnapshot report={workflowState.research_report} />
             <TechnicalAnalysisPanel report={workflowState.research_report} />
          </div>

          <FundamentalsPanel report={workflowState.research_report} strategy={workflowState.strategy_report} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StrategyPanel report={workflowState.strategy_report} />
            <RiskPanel report={workflowState.risk_report} />
          </div>
          
          <NewsAnalysisPanel report={workflowState.research_report} />
          
          <ExplainabilityPanel state={workflowState} />
          
          <WorkflowTimeline state={workflowState} />

          <footer className="mt-8 pt-8 border-t border-outline-variant/20 flex flex-col md:flex-row items-center justify-between gap-4 text-label-md text-on-surface-variant">
            <div>
              Generated on {new Date().toLocaleString()}
            </div>
            <div className="flex gap-4">
              <span>Data: <span className="font-bold">Yahoo Finance</span></span>
              <span>Engine: <span className="font-bold">{isRuleBased ? 'Rule-Based Fallback' : 'Gemini AI'}</span></span>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
};
