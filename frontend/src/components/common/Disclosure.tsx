import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DisclosureProps {
  label: string;
  /** e.g. the number of items inside */
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Progressive disclosure: the summary stays scannable, the supporting evidence is one click away. */
export const Disclosure: React.FC<DisclosureProps> = ({ label, count, defaultOpen = false, children, className }) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className={cn('border-t border-line pt-3', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="group -ml-1 flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-xs font-medium text-ink-soft hover:text-ink"
      >
        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-muted transition-transform', open ? 'rotate-0' : '-rotate-90')} aria-hidden="true" />
        <span>{label}</span>
        {count != null && <span className="font-normal text-ink-muted">({count})</span>}
      </button>
      <div id={panelId} hidden={!open} className="pt-2">
        {open && children}
      </div>
    </div>
  );
};
