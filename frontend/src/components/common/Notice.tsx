import React from 'react';
import { AlertTriangle, CircleCheck, Info, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Tone, TONE_BADGE } from './tone';

interface NoticeProps {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  /** errors that need attention use role="alert"; everything else is a polite status */
  urgent?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

const ICONS = { accent: CircleCheck, caution: AlertTriangle, danger: XCircle, neutral: Info } as const;

export const Notice: React.FC<NoticeProps> = ({ tone = 'neutral', title, children, urgent, actions, className }) => {
  const Icon = ICONS[tone];
  return (
    <div role={urgent ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', TONE_BADGE[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn('text-sm', title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
};
