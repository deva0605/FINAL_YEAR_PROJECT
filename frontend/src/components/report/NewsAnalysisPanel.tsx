import React from 'react';
import { ResearchReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { NewsCard } from '../common/NewsCard';

interface NewsAnalysisPanelProps {
  report?: ResearchReport;
}

export const NewsAnalysisPanel: React.FC<NewsAnalysisPanelProps> = ({ report }) => {
  const articles = report?.latest_news || [];

  return (
    <SectionCard title="Market Intelligence" badge="News">
      {articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        <div className="text-xs text-slate-500 text-center py-8 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
          No news articles retrieved for this symbol.
        </div>
      )}
    </SectionCard>
  );
};
