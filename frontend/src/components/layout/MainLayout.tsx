import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function MainLayout() {
  return (
    <div className="flex bg-background font-body-md text-on-background min-h-screen">
      <Sidebar />
      <div className="pl-72 w-full flex flex-col">
        <Header />
        <main className="pt-32 p-8 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
