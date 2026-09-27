import React from 'react';
import { cn } from '../../utils/cn';

interface ScoreBadgeProps {
  score?: number | null;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

function colorForScore(score: number) {
  if (score >= 65) return 'text-emerald-800 bg-emerald-50 border-emerald-200/80';
  if (score >= 45) return 'text-amber-800 bg-amber-50 border-amber-200/80';
  return 'text-rose-800 bg-rose-50 border-rose-200/80';
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, label, size = 'md' }) => {
  if (score == null) return null;
  const color = colorForScore(score);
  const sizeClass = size === 'lg' ? 'text-xl px-4 py-2' : size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <div className={cn('inline-flex flex-col items-center border rounded-lg font-mono', sizeClass, color)}>
      <span className="font-black leading-none tabular-nums">{score.toFixed(0)}<span className="text-xs font-normal opacity-60">/100</span></span>
      {label && <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{label}</span>}
    </div>
  );
};

interface RecommendationBadgeProps {
  recommendation?: string;
  large?: boolean;
}

export const RecommendationBadge: React.FC<RecommendationBadgeProps> = ({ recommendation, large }) => {
  const rec = (recommendation || '').toUpperCase();
  const color = rec.includes('BUY')
    ? 'text-emerald-800 border-emerald-200/80 bg-emerald-50'
    : rec.includes('SELL')
    ? 'text-rose-800 border-rose-200/80 bg-rose-50'
    : 'text-amber-800 border-amber-200/80 bg-amber-50';

  return (
    <div className={cn(
      'inline-flex items-center justify-center border font-black rounded-lg tracking-widest uppercase font-mono',
      color,
      large ? 'text-3xl px-6 py-2.5' : 'text-[10px] px-2 py-0.5'
    )}>
      {recommendation || 'N/A'}
    </div>
  );
};

interface RiskBadgeProps {
  risk?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk }) => {
  const r = (risk || '').toLowerCase();
  const color = r.includes('high') || r.includes('very')
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : r.includes('low')
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : 'text-amber-700 bg-amber-50 border-amber-200';

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase border font-mono', color)}>
      {risk || '—'}
    </span>
  );
};

interface SentimentBadgeProps {
  sentiment?: string;
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({ sentiment }) => {
  const s = (sentiment || '').toLowerCase();
  const color = s === 'bullish'
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : s === 'bearish'
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : 'text-slate-600 bg-slate-50 border-slate-200';

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border font-mono', color)}>
      {sentiment || 'Neutral'}
    </span>
  );
};
