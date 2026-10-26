// Small display helpers. They only reformat values the backend already sent.

export function exchangeFor(ticker?: string | null): string | undefined {
  const t = (ticker || '').toUpperCase();
  if (t.endsWith('.NS')) return 'NSE';
  if (t.endsWith('.BO')) return 'BSE';
  return undefined; // other markets: the report does not say, so we do not guess
}

export function formatDateTime(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatSeconds(seconds?: number | null): string | undefined {
  if (seconds == null || !Number.isFinite(seconds)) return undefined;
  return seconds >= 10 ? `${seconds.toFixed(0)}s` : `${seconds.toFixed(1)}s`;
}

export function formatPercent(fraction?: number | null, digits = 0): string | undefined {
  if (fraction == null || !Number.isFinite(fraction)) return undefined;
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Plain-language message for an error thrown by the API client. */
export function friendlyError(message?: string | null): { title: string; detail?: string } {
  const m = message || '';
  if (/failed to fetch|networkerror|load failed|network error/i.test(m)) {
    return {
      title: "Can't reach the analysis service.",
      detail: 'Check that the backend is running (http://localhost:8000) and try again.',
    };
  }
  if (/HTTP error! status: (5\d\d)/.test(m)) {
    return { title: 'The analysis service ran into a problem.', detail: `${m}. Try again in a moment.` };
  }
  if (/HTTP error! status: 4\d\d/.test(m)) {
    return { title: 'The request was not accepted.', detail: m };
  }
  return { title: 'The analysis could not be completed.', detail: m || undefined };
}

/** Plain-language version of a workflow error recorded by the backend. */
export function friendlyWorkflowError(message: string): string {
  if (/ticker not found/i.test(message)) {
    return "We couldn't match that to a listed company or ticker. Try a ticker such as RELIANCE.NS, or the full company name.";
  }
  if (/no market data|ticker not found or no market data/i.test(message)) {
    return 'No market data was available for this symbol, so the research could not be built.';
  }
  return message;
}
