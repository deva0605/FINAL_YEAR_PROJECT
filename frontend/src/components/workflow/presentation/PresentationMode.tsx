import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { AgentCard } from './AgentCard';

const AGENTS = [
  {
    id: 'research',
    name: 'Research agent',
    icon: 'manage_search',
    messages: ['Fetching market data…', 'Retrieving financial statements…', 'Reading company profile…', 'Fetching historical prices…', 'Collecting market metrics…', 'Reading latest news…', 'Indexing documents…'],
    defaultDuration: 3500,
  },
  {
    id: 'strategy',
    name: 'Strategy agent',
    icon: 'analytics',
    messages: ['Analyzing growth…', 'Evaluating fundamentals…', 'Building investment thesis…', 'Generating bull case…', 'Generating bear case…', 'Estimating return potential…'],
    defaultDuration: 3000,
  },
  {
    id: 'risk',
    name: 'Risk agent',
    icon: 'shield',
    messages: ['Calculating volatility…', 'Checking liquidity…', 'Analyzing valuation…', 'Evaluating news risk…', 'Checking sector exposure…', 'Assessing macroeconomic risk…'],
    defaultDuration: 2500,
  },
  {
    id: 'decision',
    name: 'Decision agent',
    icon: 'gavel',
    messages: ['Combining agent results…', 'Scoring investment…', 'Calculating confidence…', 'Generating recommendation…', 'Preparing explainable report…'],
    defaultDuration: 2500,
  },
];

interface PresentationModeProps {
  query: string;
  isApiComplete: boolean;
  /** how the finished run ended; the closing screen must not claim success for a failed run */
  outcome?: 'success' | 'failed';
  onPresentationComplete: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({ query, isApiComplete, outcome = 'success', onPresentationComplete }) => {
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [typedQuery, setTypedQuery] = useState('');

  useEffect(() => {
    if (currentStep !== -1) return;
    let i = 0;
    const interval = setInterval(() => {
      setTypedQuery(query.substring(0, i + 1));
      i++;
      if (i >= query.length) {
        clearInterval(interval);
        setTimeout(() => setCurrentStep(0), 600);
      }
    }, Math.min(30, 600 / query.length));
    return () => clearInterval(interval);
  }, [query, currentStep]);

  useEffect(() => {
    if (currentStep === -1 || currentStep >= 4) return;
    const agent = AGENTS[currentStep];
    const duration = isApiComplete ? 400 : agent.defaultDuration;

    const timer = setTimeout(() => {
      if (currentStep === 3 && !isApiComplete) {
        // the last step waits for the real response
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [currentStep, isApiComplete]);

  useEffect(() => {
    if (currentStep === 4) {
      const t = setTimeout(() => onPresentationComplete(), 1500);
      return () => clearTimeout(t);
    }
  }, [currentStep, onPresentationComplete]);

  useEffect(() => {
    if (currentStep === 3 && isApiComplete) {
      const t = setTimeout(() => setCurrentStep(4), 400);
      return () => clearTimeout(t);
    }
  }, [isApiComplete, currentStep]);

  const totalSteps = AGENTS.length;
  const progressPercent = currentStep === -1 ? 0 : currentStep === 4 ? 100 : Math.round((currentStep / totalSteps) * 100);
  const failed = outcome === 'failed';

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-6">
      <div className="card px-5 py-4">
        <div className="text-xs text-ink-muted">Your request</div>
        <p className="mt-1 min-h-[1.75rem] text-lg font-medium leading-snug text-ink">
          {typedQuery}
          {currentStep === -1 && <span className="ml-0.5 animate-pulse text-ink-faint" aria-hidden="true">|</span>}
        </p>
      </div>

      <div className="card relative min-h-[340px] overflow-hidden p-5" aria-busy={currentStep !== 4}>
        <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
          <span>Agent progress</span>
          <span className="tabular-nums">{progressPercent}%</span>
        </div>
        <div className="mb-4 h-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} aria-label="Agent progress">
          <motion.div className="h-full bg-accent" initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} transition={{ ease: 'easeInOut', duration: 0.5 }} />
        </div>

        <ol className="relative flex flex-col gap-2.5">
          <AnimatePresence>
            {currentStep === 4 && (
              <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-10 flex list-none flex-col items-center justify-center bg-white">
                <div className={failed ? 'mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-caution-line bg-caution-soft text-caution-ink' : 'mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-accent-line bg-accent-soft text-accent-ink'}>
                  {failed ? <TriangleAlert className="h-5 w-5" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                </div>
                <h2 className="text-sm font-semibold text-ink">{failed ? 'The research could not be completed' : 'Analysis complete'}</h2>
              </motion.li>
            )}
          </AnimatePresence>

          {AGENTS.map((agent, idx) => {
            if (idx > currentStep && currentStep !== 4) return null;
            return (
              <AgentCard
                key={agent.id}
                id={agent.id}
                name={agent.name}
                icon={agent.icon}
                messages={agent.messages}
                status={currentStep > idx || currentStep === 4 ? 'completed' : currentStep === idx ? 'active' : 'pending'}
                progress={currentStep > idx ? 100 : currentStep === idx ? (isApiComplete ? 95 : undefined) : 0}
              />
            );
          })}
        </ol>
      </div>

      <p className="text-center text-xs text-ink-muted">Progress is indicative: the backend returns results once every agent has finished.</p>
    </div>
  );
};
