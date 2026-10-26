import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, FileText, History, LayoutGrid, Scale, Search, Settings, ShieldCheck, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

interface NavEntry {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const platformItems: NavEntry[] = [
  { path: '/', label: 'Intelligence Hub', icon: LayoutGrid },
  { path: '/research', label: 'Deep Research', icon: Search, badge: 'AI' },
  { path: '/strategies', label: 'Alpha Factor Lab', icon: Activity },
  { path: '/risk', label: 'VaR Risk Models', icon: ShieldCheck },
];

const governanceItems: NavEntry[] = [
  { path: '/decision', label: 'Decision Engine', icon: Scale },
  { path: '/report', label: 'Audit Trails', icon: FileText },
  { path: '/history', label: 'Research History', icon: History },
  { path: '/settings', label: 'Engine Settings', icon: Settings },
];

function NavItem({ item }: { item: NavEntry }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-slate-100 font-medium text-ink' : 'text-ink-soft hover:bg-slate-50 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-full bg-accent" aria-hidden="true" />}
          <span className="flex items-center gap-2.5">
            <Icon className={cn('h-4 w-4', isActive ? 'text-accent' : 'text-ink-muted group-hover:text-ink-soft')} aria-hidden="true" />
            {item.label}
          </span>
          {item.badge && <span className="rounded border border-line bg-white px-1.5 text-[11px] font-medium text-ink-muted">{item.badge}</span>}
        </>
      )}
    </NavLink>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  // Escape closes the mobile drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        aria-label="Primary"
        className={cn(
          'no-print fixed inset-y-0 left-0 z-50 flex w-[232px] flex-col border-r border-line bg-white transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white" aria-hidden="true">
              <Zap className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-ink">FinAI Cloud</span>
                <span className="rounded border border-line bg-canvas px-1.5 text-[11px] font-medium text-ink-muted">v4.2</span>
              </div>
              <span className="text-xs text-ink-muted">Institutional Mesh</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost -mr-2 p-1.5 lg:hidden" aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <div>
            <div className="mb-1.5 px-3 text-xs font-medium text-ink-muted">Platform</div>
            <div className="space-y-0.5">
              {platformItems.map((item) => (
                <NavItem key={item.path} item={item} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 px-3 text-xs font-medium text-ink-muted">Governance</div>
            <div className="space-y-0.5">
              {governanceItems.map((item) => (
                <NavItem key={item.path} item={item} />
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white" aria-hidden="true">
              DV
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">Devesh V.</p>
              <p className="truncate text-xs text-ink-muted">Quant Desk · Pro</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
