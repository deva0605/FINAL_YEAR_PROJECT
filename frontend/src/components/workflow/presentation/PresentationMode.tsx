import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentCard } from './AgentCard';
import { cn } from '../../../utils/cn';

const AGENTS = [
  {
    id: 'research',
    name: 'Research Agent',
    icon: 'manage_search',
    messages: ['Fetching Market Data...', 'Retrieving Financial Statements...', 'Reading Company Profile...', 'Fetching Historical Prices...', 'Collecting Market Metrics...', 'Reading Latest News...', 'Indexing Documents...'],
    defaultDuration: 3500
  },
  {
    id: 'strategy',
    name: 'Strategy Agent',
    icon: 'analytics',
    messages: ['Analyzing Growth...', 'Evaluating Fundamentals...', 'Building Investment Thesis...', 'Generating Bull Case...', 'Generating Bear Case...', 'Estimating Return Potential...'],
    defaultDuration: 3000
  },
  {
    id: 'risk',
    name: 'Risk Agent',
    icon: 'shield',
    messages: ['Calculating Volatility...', 'Checking Liquidity...', 'Analyzing Valuation...', 'Evaluating News Risk...', 'Checking Sector Exposure...', 'Assessing Macroeconomic Risk...'],
    defaultDuration: 2500
  },
  {
    id: 'decision',
    name: 'Decision Agent',
    icon: 'gavel',
    messages: ['Combining Agent Results...', 'Scoring Investment...', 'Calculating Confidence...', 'Generating Recommendation...', 'Preparing Explainable Report...'],
    defaultDuration: 2500
  }
];

interface PresentationModeProps {
  query: string;
  isApiComplete: boolean;
  onPresentationComplete: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({ query, isApiComplete, onPresentationComplete }) => {
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
      } else {
        setCurrentStep(prev => prev + 1);
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

  return (
    <div className="w-full max-w-2xl mx-auto py-10 flex flex-col gap-6">
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mb-1.5 font-bold">Query Parse</div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-tight min-h-[1.75rem]">
          {typedQuery}
          {currentStep === -1 && <span className="animate-pulse ml-1 text-slate-400">|</span>}
        </h2>
      </div>

      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 shadow-inner flex flex-col gap-4 relative min-h-[350px] overflow-hidden">
        <div className="flex justify-between text-[10px] font-mono font-bold text-slate-500 mb-1">
          <span>Agent Synchronization</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1 bg-slate-200 rounded-full overflow-hidden mb-2">
          <motion.div 
            className="h-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ ease: "easeInOut", duration: 0.5 }}
          />
        </div>

        <div className="flex flex-col gap-3 relative">
          <AnimatePresence>
            {currentStep === 4 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4 border border-emerald-200">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <h2 className="text-sm font-bold font-mono text-slate-900 uppercase tracking-wide">Analysis Complete</h2>
              </motion.div>
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
        </div>
      </div>
    </div>
  );
};
