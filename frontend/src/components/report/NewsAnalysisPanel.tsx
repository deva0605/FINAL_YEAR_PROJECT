import React from 'react';
import { ResearchReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { NewsCard } from '../common/NewsCard';
import { SentimentBadge } from '../common/Badges';

interface NewsAnalysisPanelProps {
  report?: ResearchReport;
}

export const NewsAnalysisPanel: React.FC<NewsAnalysisPanelProps> = ({ report }) => {
  const articles = report?.latest_news || [];
  const sources = report?.sources || [];

  return (
    <SectionCard title="News Analysis" icon="newspaper" accent="primary">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex flex-col items-center p-4 bg-surface-container-low rounded-xl border border-outline-variant/10 min-w-[100px]">
          <span className="text-2xl font-black text-on-surface">{articles.length}</span>
          <span className="text-label-sm text-on-surface-variant">Articles</span>
        </div>
        <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Market Sentiment</div>
          <SentimentBadge sentiment={report?.sentiment} />
        </div>
      </div>

      {articles.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Latest Headlines</div>
          {articles.map((article, i) => (
            <NewsCard
              key={i}
              title={article.title}
              url={article.url}
              date={article.publish_date}
            />
          ))}
        </div>
      ) : (
        <div className="text-on-surface-variant text-center py-6">No news articles retrieved.</div>
      )}

      {sources.length > 0 && (
        <div className="mt-4 pt-4 border-t border-outline-variant/20">
          <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Data Sources</div>
          <div className="flex flex-wrap gap-2">
            {sources.slice(0, 5).map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate max-w-xs">{src}</a>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
};
