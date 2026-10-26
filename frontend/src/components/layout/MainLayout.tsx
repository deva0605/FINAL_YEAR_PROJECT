import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function MainLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  // close the mobile drawer after navigating
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className="min-h-screen w-full bg-canvas font-sans text-ink-soft antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[232px]">
        <Header onOpenNav={() => setNavOpen(true)} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 lg:py-8">
          <Outlet />
        </main>
        <footer className="no-print border-t border-line bg-white px-4 py-4 text-xs text-ink-muted sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="font-medium text-ink-soft">FinAI Cloud</span> · Multi-agent investment research
            </span>
            <span>Research output is informational and is not investment advice.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
