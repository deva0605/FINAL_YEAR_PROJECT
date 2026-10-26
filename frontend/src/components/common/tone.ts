// Semantic colour roles shared by badges, notices and status chips.
// accent = teal/positive, caution = orange, danger = red, neutral = muted slate.
export type Tone = 'accent' | 'caution' | 'danger' | 'neutral';

export const TONE_BADGE: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-ink border-accent-line',
  caution: 'bg-caution-soft text-caution-ink border-caution-line',
  danger: 'bg-danger-soft text-danger-ink border-danger-line',
  neutral: 'bg-slate-50 text-ink-soft border-line',
};

export const TONE_DOT: Record<Tone, string> = {
  accent: 'bg-accent',
  caution: 'bg-caution',
  danger: 'bg-danger',
  neutral: 'bg-ink-faint',
};

export const TONE_TEXT: Record<Tone, string> = {
  accent: 'text-accent-ink',
  caution: 'text-caution-ink',
  danger: 'text-danger-ink',
  neutral: 'text-ink-muted',
};

// Colour role for a risk or valuation label such as "Low Risk", "Moderate", "Stretched" or "Unknown".
export function toneForRisk(risk: string): Tone {
  const r = risk.toLowerCase();
  if (!r || r.includes('unknown') || r === 'n/a') return 'neutral';
  if (r.includes('high') || r.includes('very') || r.includes('stretched') || r.includes('overvalued')) return 'danger';
  if (r.includes('low') || r.includes('undervalued') || r.includes('fair')) return 'accent';
  return 'caution';
}
