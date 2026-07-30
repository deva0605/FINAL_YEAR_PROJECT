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
    className="flex items-start gap-3 p-4 bg-surface-container-low hover:bg-surface-container rounded-xl transition-colors border border-outline-variant/10 group"
  >
    <span className="material-symbols-outlined text-on-surface-variant text-[20px] mt-0.5 flex-shrink-0">newspaper</span>
    <div className="flex-1 min-w-0">
      <p className="text-body-md text-on-surface group-hover:text-primary transition-colors leading-snug line-clamp-2">{title}</p>
      {date && <p className="text-label-sm text-on-surface-variant mt-1">{date}</p>}
    </div>
    <span className="material-symbols-outlined text-on-surface-variant text-[16px] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
  </a>
);
