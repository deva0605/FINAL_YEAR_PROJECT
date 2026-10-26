// Display formatting only: reports carry raw numbers plus an ISO `currency` code (null when the
// backend could not verify it). Mirrors backend/currency.py.

const UNKNOWN_SYMBOL = '¤'; // generic currency sign: "some currency, not identified"
const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$' };

export type CurrencyCode = string | null | undefined;

function prefix(currency: CurrencyCode): string {
  const code = typeof currency === 'string' ? currency.trim() : '';
  if (code.length !== 3 || !/^[A-Za-z]{3}$/.test(code)) return UNKNOWN_SYMBOL;
  return SYMBOLS[code.toUpperCase()] ?? `${code} `;
}

export function formatMoney(value: number | null | undefined, currency: CurrencyCode, decimals = 2): string {
  if (value == null) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}${prefix(currency)}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// Scaled amounts (market cap etc.): '₹16.1 trillion', '$3.5 billion'.
export function formatLargeAmount(value: number | null | undefined, currency: CurrencyCode): string {
  if (value == null) return '—';
  const sign = value < 0 ? '-' : '';
  const magnitude = Math.abs(value);
  const scales: [number, string][] = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
  for (const [threshold, word] of scales) {
    if (magnitude >= threshold) return `${sign}${prefix(currency)}${(magnitude / threshold).toFixed(1)} ${word}`;
  }
  return formatMoney(value, currency);
}
