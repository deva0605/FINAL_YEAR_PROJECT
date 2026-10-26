// PDF-only styling. The colours are the dashboard palette (navy ink, teal accent, orange caution) written out as
// hex values, because @react-pdf/renderer cannot read Tailwind classes or CSS variables.
import { Font } from '@react-pdf/renderer';
import interRegular from '../assets/fonts/Inter_400Regular.ttf?url';
import interMedium from '../assets/fonts/Inter_500Medium.ttf?url';
import interSemiBold from '../assets/fonts/Inter_600SemiBold.ttf?url';
import interBold from '../assets/fonts/Inter_700Bold.ttf?url';

export const COLORS = {
  ink: '#0f172a',
  soft: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  canvas: '#f8fafc',
  wash: '#f1f5f9',
  white: '#ffffff',
  accent: '#059669',
  accentSoft: '#ecfdf5',
  accentLine: '#a7f3d0',
  accentInk: '#065f46',
  caution: '#d97706',
  cautionSoft: '#fffbeb',
  cautionLine: '#fde68a',
  cautionInk: '#92400e',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerLine: '#fecaca',
  dangerInk: '#991b1b',
} as const;

export type PdfTone = 'accent' | 'caution' | 'danger' | 'neutral';

export const TONES: Record<PdfTone, { bg: string; border: string; text: string; solid: string }> = {
  accent: { bg: COLORS.accentSoft, border: COLORS.accentLine, text: COLORS.accentInk, solid: COLORS.accent },
  caution: { bg: COLORS.cautionSoft, border: COLORS.cautionLine, text: COLORS.cautionInk, solid: COLORS.caution },
  danger: { bg: COLORS.dangerSoft, border: COLORS.dangerLine, text: COLORS.dangerInk, solid: COLORS.danger },
  neutral: { bg: COLORS.canvas, border: COLORS.line, text: COLORS.soft, solid: COLORS.faint },
};

export const FONT = 'Inter';

let registered = false;

/**
 * Inter (SIL Open Font License 1.1) is embedded because the built-in PDF fonts cannot draw the rupee sign.
 * The files are bundled by Vite and fetched locally; nothing is requested from an external font service.
 */
export function registerPdfFonts(): void {
  if (registered) return;
  Font.register({
    family: FONT,
    fonts: [
      { src: interRegular, fontWeight: 400 },
      { src: interMedium, fontWeight: 500 },
      { src: interSemiBold, fontWeight: 600 },
      { src: interBold, fontWeight: 700 },
    ],
  });
  // never hyphenate: words such as tickers and company names must stay intact
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
