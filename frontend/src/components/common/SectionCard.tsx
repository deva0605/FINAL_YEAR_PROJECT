import React from 'react';
import { cn } from '../../utils/cn';

interface SectionCardProps {
  title: string;
  /** one line under the title that says what the section tells you */
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** small muted tag after the title, e.g. "Valuation" */
  badge?: string;
  /** right-aligned slot in the header (status chips, buttons) */
  actions?: React.ReactNode;
  id?: string;
  /** kept for backwards compatibility; the redesigned cards do not use accent stripes */
  accent?: 'primary' | 'secondary' | 'error' | 'tertiary';
  icon?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, description, children, className, badge, actions, id }) => {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn('card scroll-mt-24 overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 id={headingId} className="flex items-baseline gap-2 text-sm font-semibold text-ink">
            {title}
            {badge && <span className="text-xs font-normal text-ink-muted">{badge}</span>}
          </h2>
          {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
};
