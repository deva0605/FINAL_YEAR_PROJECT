import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { path: '/research', label: 'Research', icon: 'newspaper' },
  { path: '/strategies', label: 'Strategies', icon: 'analytics' },
  { path: '/risk', label: 'Risk', icon: 'warning' },
  { path: '/decision', label: 'Decision', icon: 'gavel' },
  { path: '/report', label: 'Reports', icon: 'public' },
  { path: '/history', label: 'History', icon: 'history' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-lowest z-50 flex flex-col border-r border-outline-variant shadow-sm">
      <div className="p-6 flex flex-col gap-1">
        <h1 className="text-title-lg font-headline-lg text-primary tracking-tight">Market Intelligence</h1>
        <p className="text-label-md font-label-md text-on-surface-variant uppercase tracking-widest">BSE X GLOBAL ANALYTICS</p>
      </div>

      <nav className="flex-1 px-4 mt-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "w-full flex items-center px-4 py-3 rounded-lg transition-all gap-3",
                isActive
                  ? "bg-primary-container text-on-primary-container font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              )
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="font-body-md">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-outline-variant">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-[20px]">person</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-body-md font-bold text-on-surface">Devesh</span>
            <span className="text-label-md text-on-surface-variant">Pro Analyst Plan</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
