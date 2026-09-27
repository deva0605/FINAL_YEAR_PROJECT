import React from 'react';

interface NewsCardProps {
  title: string;
  url?: string;
  date?: string;
}

export const NewsCard: React.FC<NewsCardProps> = ({ title, url, date }) => (
  <a
    href={url || '#'}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors border border-slate-200/80 group shadow-xs"
  >
    <svg className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-snug line-clamp-2">{title}</p>
      {date && <p className="text-[10px] text-slate-400 font-mono mt-1">{date}</p>}
    </div>
    <svg className="w-3 h-3 text-slate-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  </a>
);
