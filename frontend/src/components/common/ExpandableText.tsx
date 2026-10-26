import React, { useId, useState } from 'react';
import { cn } from '../../utils/cn';

interface ExpandableTextProps {
  text: string;
  /** below this length the text is shown in full with no toggle */
  threshold?: number;
  className?: string;
}

/** Long analytical paragraphs are clamped to a few lines with an explicit "Show more". */
export const ExpandableText: React.FC<ExpandableTextProps> = ({ text, threshold = 320, className }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const long = text.length > threshold;
  return (
    <div className={className}>
      <p id={id} className={cn('text-sm leading-relaxed text-ink-soft', long && !open && 'line-clamp-4')}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className="mt-1 rounded text-xs font-medium text-accent-ink hover:underline"
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};
