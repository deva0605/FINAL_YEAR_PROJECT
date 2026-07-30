import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';

export const Research: React.FC = () => {
  const { workflowState } = useWorkflowStore();
  const report = workflowState?.research_report;

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-on-surface-variant">
        <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">newspaper</span>
        <h2 className="text-headline-sm font-bold">No Research Data</h2>
        <p>Run an analysis from the dashboard to generate a research report.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-display-sm font-bold text-on-surface">Research Findings</h2>
        <div className="px-3 py-1 bg-primary-container text-on-primary-container rounded-full text-sm font-bold">
          {report.company || report.symbol}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30">
            <h3 className="text-title-lg font-bold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">analytics</span> Market Overview
            </h3>
            <div className="text-body-md text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {report.summary}
            </div>
          </section>

          {report.context && report.context.length > 0 && (
            <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30">
              <h3 className="text-title-lg font-bold text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">feed</span> Recent Context & News
              </h3>
              <ul className="space-y-3">
                {report.context.map((ctx, idx) => (
                  <li key={idx} className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20 text-sm text-on-surface-variant">
                    {ctx}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">
           <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30">
            <h3 className="text-title-lg font-bold text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">show_chart</span> Market Data (Latest)
            </h3>
            {report.market_data && report.market_data.length > 0 ? (
              <div className="flex flex-col gap-4">
                {(() => {
                  const latest = report.market_data[report.market_data.length - 1];
                  return (
                    <>
                      <div className="flex justify-between border-b border-outline-variant/20 pb-2">
                        <span className="text-on-surface-variant">Close</span>
                        <span className="font-bold text-on-surface">₹{Number(latest.Close || latest.close || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-b border-outline-variant/20 pb-2">
                        <span className="text-on-surface-variant">Open</span>
                        <span className="font-bold text-on-surface">₹{Number(latest.Open || latest.open || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-b border-outline-variant/20 pb-2">
                        <span className="text-on-surface-variant">High</span>
                        <span className="font-bold text-on-surface">₹{Number(latest.High || latest.high || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pb-2">
                        <span className="text-on-surface-variant">Low</span>
                        <span className="font-bold text-on-surface">₹{Number(latest.Low || latest.low || 0).toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
               <p className="text-sm text-on-surface-variant">No market data available.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
