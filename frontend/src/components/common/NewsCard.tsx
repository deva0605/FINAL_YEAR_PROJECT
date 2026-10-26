import React from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';

interface NewsCardProps {
  title: string;
  url?: string;
  date?: string;
}

const body = (title: string, date?: string, linked = false) => (
  <>
    <Newspaper className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-faint" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="text-sm leading-snug text-ink-soft group-hover:text-ink">{title}</p>
      {date && <p className="mt-1 text-xs text-ink-muted">{date}</p>}
    </div>
    {linked && (
      <>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </>
    )}
  </>
);

export const NewsCard: React.FC<NewsCardProps> = ({ title, url, date }) =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 rounded-lg border border-line bg-white p-3 transition-colors hover:border-line-strong hover:bg-canvas">
      {body(title, date, true)}
    </a>
  ) : (
    <div className="group flex items-start gap-3 rounded-lg border border-line bg-white p-3">{body(title, date)}</div>
  );
