import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** show a link back to the dashboard composer (default: yes) */
  showRunLink?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, showRunLink = true, className }) => (
  <div className={cn('card flex flex-col items-center px-6 py-16 text-center', className)}>
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-canvas text-ink-muted" aria-hidden="true">
      {icon}
    </div>
    <h2 className="text-base font-semibold text-ink">{title}</h2>
    <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
    {showRunLink && (
      <Link to="/" className="btn-secondary mt-5">
        Go to the research workspace
      </Link>
    )}
  </div>
);
