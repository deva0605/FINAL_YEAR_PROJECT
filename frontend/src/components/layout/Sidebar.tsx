import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';

const platformItems = [
  { path: '/', label: 'Intelligence Hub', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect height="7" rx="1" width="7" x="3" y="3" /><rect height="7" rx="1" width="7" x="14" y="3" />
      <rect height="7" rx="1" width="7" x="14" y="14" /><rect height="7" rx="1" width="7" x="3" y="14" />
    </svg>
  )},
  { path: '/research', label: 'Deep Research', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" />
    </svg>
  ), badge: 'AI' },
  { path: '/strategies', label: 'Alpha Factor Lab', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )},
  { path: '/risk', label: 'VaR Risk Models', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )},
];

const governanceItems = [
  { path: '/decision', label: 'Decision Engine', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )},
  { path: '/report', label: 'Audit Trails', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )},
  { path: '/history', label: 'Research History', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )},
  { path: '/settings', label: 'Engine Settings', icon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )},
];

function NavItem({ item }: { item: typeof platformItems[0] & { badge?: string } }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          "flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
          isActive
            ? "bg-slate-100 text-slate-900 border border-slate-200/60 shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className="flex items-center gap-2.5">
            <span className={cn(isActive ? "text-slate-700" : "text-slate-400")}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </div>
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          {item.badge && !isActive && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-100 text-slate-500">{item.badge}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="w-[260px] flex-shrink-0 bg-white border-r border-surface-border flex flex-col justify-between fixed inset-y-0 left-0 z-40">
      <div className="flex flex-col h-full bg-white">
        {/* Logo */}
        <div className="px-4 py-3.5 border-b border-slate-200/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-white shadow-xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-xs font-semibold text-slate-900 tracking-tight">FinAI Cloud</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-medium bg-slate-100 text-slate-600 rounded border border-slate-200">v4.2</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">Institutional Mesh</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Platform</div>
          {platformItems.map((item) => <NavItem key={item.path} item={item} />)}

          <div className="pt-4 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Governance</div>
          {governanceItems.map((item) => <NavItem key={item.path} item={item} />)}
        </nav>

        {/* User Profile */}
        <div className="p-3 border-t border-slate-200/80">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/70 hover:bg-slate-100/60 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-semibold text-xs flex items-center justify-center font-mono">DV</div>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">Devesh V.</p>
                <p className="text-[10px] text-slate-400 truncate font-mono">Quant Desk · Pro</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
