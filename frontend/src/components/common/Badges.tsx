import React from 'react';
import { cn } from '../../utils/cn';
import { Tone, TONE_BADGE, TONE_DOT, toneForRisk } from './tone';

interface ScoreBadgeProps {
  score?: number | null;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

function toneForScore(score: number): Tone {
  if (score >= 65) return 'accent';
  if (score >= 45) return 'caution';
  return 'danger';
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, label, size = 'md' }) => {
  if (score == null) return null;
  const sizeClass = size === 'lg' ? 'text-xl px-4 py-2' : size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <div className={cn('inline-flex flex-col items-center rounded-lg border tabular-nums', sizeClass, TONE_BADGE[toneForScore(score)])}>
      <span className="font-semibold leading-none">
        {score.toFixed(0)}
        <span className="text-xs font-normal opacity-70">/100</span>
      </span>
      {label && <span className="mt-0.5 text-xs">{label}</span>}
    </div>
  );
};

interface RecommendationBadgeProps {
  recommendation?: string;
  large?: boolean;
}

function toneForRecommendation(rec: string): Tone {
  if (!rec) return 'neutral';
  if (rec.includes('BUY')) return 'accent';
  if (rec.includes('SELL')) return 'danger';
  return 'caution'; // HOLD
}

export const RecommendationBadge: React.FC<RecommendationBadgeProps> = ({ recommendation, large }) => {
  const rec = (recommendation || '').toUpperCase();
  const tone = toneForRecommendation(rec);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border font-semibold tracking-wide',
        TONE_BADGE[tone],
        large ? 'px-3.5 py-1.5 text-xl' : 'px-2 py-0.5 text-xs',
      )}
    >
      <span className={cn('rounded-full', TONE_DOT[tone], large ? 'h-2 w-2' : 'h-1.5 w-1.5')} aria-hidden="true" />
      {recommendation || 'N/A'}
    </span>
  );
};

interface RiskBadgeProps {
  risk?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk }) => (
  <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', TONE_BADGE[toneForRisk(risk || '')])}>
    {risk || '—'}
  </span>
);

interface SentimentBadgeProps {
  sentiment?: string;
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({ sentiment }) => {
  const s = (sentiment || '').toLowerCase();
  const tone: Tone = s === 'bullish' ? 'accent' : s === 'bearish' ? 'danger' : 'neutral';
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', TONE_BADGE[tone])}>
      {sentiment || 'Neutral'}
    </span>
  );
};
