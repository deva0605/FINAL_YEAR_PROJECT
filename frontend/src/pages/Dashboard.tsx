import React, { useState, useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { useRunAnalysis } from '../hooks/useRunAnalysis';
import { AnimatedLoading } from '../components/workflow/AnimatedLoading';
import { PresentationMode } from '../components/workflow/presentation';
import { ResearchComposer } from '../components/workflow/ResearchComposer';
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
import { StockPriceChart } from '../components/report/StockPriceChart';
import { AnalysisSourceNotice } from '../components/common/AnalysisSourceNotice';
import { Notice } from '../components/common/Notice';
import { friendlyError, friendlyWorkflowError } from '../utils/format';
import { failureOf } from '../utils/workflow';

export const Dashboard: React.FC = () => {
  const { workflowState, loading, query, isPresentationMode, error } = useWorkflowStore();
  const runAnalysis = useRunAnalysis();
  const [isPresentationFinished, setIsPresentationFinished] = useState(false);

  useEffect(() => {
    if (loading) {
      setIsPresentationFinished(false);
    }
  }, [loading]);

  const workflowFailure = failureOf(workflowState);
  const showPresentation = isPresentationMode && (loading || (workflowState && !isPresentationFinished));
  const showLoadingFallback = !isPresentationMode && loading;
  const showReport = workflowState && !workflowFailure && (!isPresentationMode || isPresentationFinished);
  const showFailure = workflowState && workflowFailure && (!isPresentationMode || isPresentationFinished);
  const showEmptyState = !loading && (!workflowState || showFailure) && !showPresentation;

  const apiError = error ? friendlyError(error) : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-6">
        {/* announced to screen readers when a run starts and ends */}
        <p className="sr-only" role="status" aria-live="polite">
          {loading ? 'Running research. This can take a minute.' : workflowState && !workflowFailure ? 'Research complete.' : ''}
        </p>

        <AnimatePresence mode="wait">
          {showPresentation && (
            <motion.div key="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex min-h-[60vh] flex-1 flex-col justify-center">
              <PresentationMode
                query={query}
                isApiComplete={!loading && workflowState !== null}
                outcome={workflowFailure ? 'failed' : 'success'}
                onPresentationComplete={() => setIsPresentationFinished(true)}
              />
            </motion.div>
          )}

          {showLoadingFallback && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto w-full max-w-2xl">
              <div className="card p-6">
                <AnimatedLoading currentStep={workflowState?.metadata?.current_step || 'research'} />
              </div>
            </motion.div>
          )}

          {showEmptyState && (
            <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mx-auto w-full max-w-3xl pt-4 sm:pt-12">
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Research any stock</h1>
                <p className="mx-auto mt-2 max-w-xl text-sm text-ink-muted sm:text-base">
                  Enter a company or ticker. Research, strategy, risk and decision agents turn market data into one explained recommendation.
                </p>
              </div>

              {apiError && (
                <Notice
                  tone="danger"
                  urgent
                  title={apiError.title}
                  className="mb-4"
                  actions={
                    <button type="button" onClick={() => runAnalysis()} className="btn-secondary px-2.5 py-1 text-xs">
                      Try again
                    </button>
                  }
                >
                  {apiError.detail}
                </Notice>
              )}

              {showFailure && workflowFailure && (
                <Notice tone="caution" urgent title="We couldn't complete that research" className="mb-4">
                  {workflowFailure.length === 1 ? (
                    <p>{friendlyWorkflowError(workflowFailure[0])}</p>
                  ) : (
                    <ul className="list-inside list-disc">
                      {workflowFailure.map((e, i) => (
                        <li key={i}>{friendlyWorkflowError(e)}</li>
                      ))}
                    </ul>
                  )}
                </Notice>
              )}

              <ResearchComposer />

              <p className="mt-6 text-center text-xs text-ink-muted">
                Analysis uses Gemini when it is available and falls back to deterministic rule-based analysis when it is not. Every report states which was used.
              </p>
            </motion.div>
          )}

          {showReport && (
            <motion.div key="report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col gap-6">
              {(workflowState.metadata?.errors?.length ?? 0) > 0 && (
                <Notice tone="danger" urgent title="This run did not finish cleanly. The results below may be incomplete.">
                  <ul className="list-inside list-disc">
                    {workflowState.metadata!.errors!.map((e, i) => (
                      <li key={i}>{friendlyWorkflowError(e)}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              <ExecutiveSummary state={workflowState!} query={query} />
              <AnalysisSourceNotice state={workflowState!} />

              {workflowState.decision_report && <DecisionPanel report={workflowState.decision_report} strategy={workflowState.strategy_report} />}

              {workflowState.research_report?.ticker && (
                <StockPriceChart
                  symbol={workflowState.research_report.ticker}
                  company={workflowState.research_report.company}
                  latestPrice={workflowState.research_report.current_price}
                  currency={workflowState.research_report.currency}
                />
              )}

              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                <MarketSnapshot report={workflowState.research_report} />
                <TechnicalAnalysisPanel report={workflowState.research_report} />
              </div>

              <FundamentalsPanel report={workflowState.research_report} strategy={workflowState.strategy_report} />

              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                <StrategyPanel report={workflowState.strategy_report} />
                <RiskPanel report={workflowState.risk_report} />
              </div>

              <NewsAnalysisPanel report={workflowState.research_report} />

              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                <ExplainabilityPanel state={workflowState} />
                <WorkflowTimeline state={workflowState} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};
