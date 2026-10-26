import React, { useState } from 'react';
import { ResearchReport } from '../../types';
import { SectionCard } from '../common/SectionCard';
import { NewsCard } from '../common/NewsCard';

interface NewsAnalysisPanelProps {
  report?: ResearchReport;
}

const INITIAL_COUNT = 4;

export const NewsAnalysisPanel: React.FC<NewsAnalysisPanelProps> = ({ report }) => {
  const articles = report?.latest_news || [];
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? articles : articles.slice(0, INITIAL_COUNT);

  return (
    <SectionCard
      id="news"
      title="Market intelligence"
      badge={articles.length > 0 ? `${articles.length} headline${articles.length === 1 ? '' : 's'}` : undefined}
      description="Recent headlines retrieved for this company."
    >
      {articles.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {visible.map((article, i) => (
              <NewsCard key={i} title={article.title} url={article.url} date={article.publish_date} />
            ))}
          </div>
          {articles.length > INITIAL_COUNT && (
            <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="mt-3 rounded text-xs font-medium text-accent-ink hover:underline">
              {showAll ? 'Show fewer' : `Show all ${articles.length}`}
            </button>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-line bg-canvas px-4 py-8 text-center text-sm text-ink-muted">
          No news articles were retrieved for this symbol, so news sentiment could not be assessed.
        </div>
      )}
    </SectionCard>
  );
};
