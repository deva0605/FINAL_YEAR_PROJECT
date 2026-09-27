import React, { useState, useEffect } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { PromptCard } from '../components/common/PromptCard';
import { AnimatedLoading } from '../components/workflow/AnimatedLoading';
import { PresentationMode } from '../components/workflow/presentation';
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
import { AnimatePresence, motion } from 'framer-motion';

export const Dashboard: React.FC = () => {
  const { workflowState, loading, setQuery, query, isPresentationMode } = useWorkflowStore();
  const [isPresentationFinished, setIsPresentationFinished] = useState(false);

  useEffect(() => {
    if (loading) {
      setIsPresentationFinished(false);
    }
  }, [loading]);

  const handlePromptClick = (text: string) => {
    setQuery(text);
  };

  const showPresentation = isPresentationMode && (loading || (workflowState && !isPresentationFinished));
  const showLoadingFallback = !isPresentationMode && loading;
  const showReport = workflowState && (!isPresentationMode || isPresentationFinished);
  const showEmptyState = !loading && !workflowState && !showPresentation;

  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence mode="wait">
        {showPresentation && (
          <motion.div
            key="presentation"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            transition={{ duration: 0.5 }}
            className="flex-1 flex flex-col justify-center min-h-[70vh]"
          >
            <PresentationMode 
              query={query} 
              isApiComplete={!loading && workflowState !== null} 
              onPresentationComplete={() => setIsPresentationFinished(true)} 
            />
          </motion.div>
        )}

        {showLoadingFallback && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center min-h-[70vh]"
          >
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 w-full max-w-4xl">
              <AnimatedLoading currentStep={workflowState?.metadata?.current_step || "research"} />
            </div>
          </motion.div>
        )}

        {showEmptyState && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex-1 space-y-6"
          >
            {/* Hero Section */}
            <section className="bg-white rounded-2xl border border-surface-border p-6 shadow-sm relative overflow-hidden">
              <div className="p-1">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-base font-semibold text-slate-900 tracking-tight">Institutional AI Research Orchestrator</h1>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">5-Agent Consensus</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Parallel synthesis across fundamental filings, risk factors, options sentiment, and valuation models.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">Engine:</span>
                    <button className="px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5">
                      <span>Gemini 2.0 Pro</span>
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                  </div>
                </div>

                <div className="relative bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 transition">
                  <div className="flex items-center px-3.5 py-2.5 gap-3">
                    <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-white flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                    <input 
                      className="flex-1 bg-transparent text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none" 
                      placeholder="Analyze Microsoft (MSFT) for long-term growth and AI market positioning." 
                      type="text" 
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { /* handeled by header usually or can call run here */ } }}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:inline-block">Press ↵</span>
                    </div>
                  </div>
                  <div className="px-3.5 py-2 bg-slate-50/70 border-t border-slate-100 rounded-b-xl flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400 font-medium mr-1 font-mono text-[10px]">Suggested queries:</span>
                    <PromptCard text="MSFT: AI Cloud & Margins" onClick={() => handlePromptClick('Analyze Microsoft (MSFT) for long-term growth and AI market positioning.')} />
                    <PromptCard text="TSLA: FSD & Robotaxi Valuation" onClick={() => handlePromptClick('Assess Tesla (TSLA) volatility and current valuation risks.')} />
                    <PromptCard text="RELIANCE: Retail & Jio IPO Impact" onClick={() => handlePromptClick('Evaluate Reliance Industries (RELIANCE.NS)')} />
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {showReport && (
          <motion.div 
            key="report"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-6"
          >
            <ExecutiveSummary state={workflowState!} query={query} />
            
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
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ExplainabilityPanel state={workflowState} />
              <WorkflowTimeline state={workflowState} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
