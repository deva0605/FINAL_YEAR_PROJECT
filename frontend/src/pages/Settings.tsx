import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Notice } from '../components/common/Notice';

function Row({ title, hint, children, last }: { title: string; hint: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 py-4 ${last ? '' : 'border-b border-line'}`}>
      <div>
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-xs text-ink-muted">{hint}</div>
      </div>
      {children}
    </div>
  );
}

const selectClass = 'rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink hover:border-line-strong disabled:opacity-60';

export const Settings: React.FC = () => {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Engine settings" />

      <Notice tone="neutral" title="Preview only">
        These controls are not connected to the backend yet, so they do not affect the analysis.
      </Notice>

      <section aria-labelledby="account-heading" className="card px-5">
        <h2 id="account-heading" className="pt-4 text-sm font-semibold text-ink">
          Account
        </h2>
        <Row title="Plan" hint="Pro Analyst Plan">
          <button type="button" disabled className="btn-secondary">
            Manage
          </button>
        </Row>
        <Row title="API key" hint="Used for custom integrations" last>
          <button type="button" disabled className="btn-secondary">
            Reveal
          </button>
        </Row>
      </section>

      <section aria-labelledby="prefs-heading" className="card px-5">
        <h2 id="prefs-heading" className="pt-4 text-sm font-semibold text-ink">
          Preferences
        </h2>
        <Row title="Default horizon" hint="Strategy agent default view">
          <select aria-label="Default horizon" className={selectClass} defaultValue="medium" disabled>
            <option value="short">Short term (1-3 months)</option>
            <option value="medium">Medium term (6-12 months)</option>
            <option value="long">Long term (1-3 years)</option>
          </select>
        </Row>
        <Row title="Risk tolerance" hint="Affects decision agent recommendations" last>
          <select aria-label="Risk tolerance" className={selectClass} defaultValue="balanced" disabled>
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </Row>
      </section>
    </div>
  );
};
