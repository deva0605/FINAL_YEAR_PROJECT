import React from 'react';
import { cn } from '../../utils/cn';

interface ScoreBadgeProps {
  score?: number | null;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

function colorForScore(score: number) {
  if (score >= 65) return 'text-secondary bg-secondary/10 border-secondary/30';
  if (score >= 45) return 'text-tertiary bg-tertiary/10 border-tertiary/30';
  return 'text-error bg-error/10 border-error/30';
}

function labelForScore(score: number) {
  if (score >= 80) return 'Strong Buy';
  if (score >= 65) return 'Buy';
  if (score >= 45) return 'Hold';
  if (score >= 25) return 'Sell';
  return 'Strong Sell';
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, label, size = 'md' }) => {
  if (score == null) return null;
  const color = colorForScore(score);
  const sizeClass = size === 'lg' ? 'text-2xl px-5 py-2' : size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <div className={cn('inline-flex flex-col items-center border rounded-xl', sizeClass, color)}>
      <span className="font-black leading-none">{score.toFixed(0)}<span className="text-xs font-normal opacity-60">/100</span></span>
      {label && <span className="text-xs font-bold uppercase tracking-wider mt-0.5">{label}</span>}
    </div>
  );
};

interface RecommendationBadgeProps {
  recommendation?: string;
  large?: boolean;
}

export const RecommendationBadge: React.FC<RecommendationBadgeProps> = ({ recommendation, large }) => {
  const rec = (recommendation || '').toUpperCase();
  const color = rec.includes('BUY') ? 'text-secondary border-secondary/40 bg-secondary/10'
    : rec.includes('SELL') ? 'text-error border-error/40 bg-error/10'
    : 'text-tertiary border-tertiary/40 bg-tertiary/10';

  return (
    <div className={cn('inline-flex items-center justify-center border-2 font-black rounded-xl tracking-widest uppercase', color, large ? 'text-4xl px-8 py-3' : 'text-lg px-4 py-1.5')}>
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
    ? 'text-error bg-error/10 border-error/20'
    : r.includes('low')
    ? 'text-secondary bg-secondary/10 border-secondary/20'
    : 'text-tertiary bg-tertiary/10 border-tertiary/20';

  return (
    <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase border', color)}>
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
    ? 'text-secondary bg-secondary/10 border-secondary/20'
    : s === 'bearish'
    ? 'text-error bg-error/10 border-error/20'
    : 'text-on-surface-variant bg-surface-container border-outline-variant/20';

  const icon = s === 'bullish' ? 'trending_up' : s === 'bearish' ? 'trending_down' : 'trending_flat';

  return (
    <span className={cn('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase border', color)}>
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {sentiment || 'Neutral'}
    </span>
  );
};
