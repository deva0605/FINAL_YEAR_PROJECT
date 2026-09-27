import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function MainLayout() {
  return (
    <div className="flex min-h-screen w-full bg-surface-bg font-sans antialiased">
      <Sidebar />
      <div className="flex-1 ml-[260px] flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
        <footer className="mt-auto px-6 py-4 border-t border-surface-border bg-white text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Fin AI</span>
            <span>© 2025 BSE & Global Financial Intelligence. All Rights Reserved.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="hover:text-slate-600 cursor-pointer">API Docs</span>
            <span className="hover:text-slate-600 cursor-pointer">Regulatory Disclaimers</span>
            <span className="hover:text-slate-600 cursor-pointer">Latency: 18ms (Mumbai-1)</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
