import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Research } from './pages/Research';
import { Strategies } from './pages/Strategies';
import { Risk } from './pages/Risk';
import { Decision } from './pages/Decision';
import { Report } from './pages/Report';
import { History } from './pages/History';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="research" element={<Research />} />
          <Route path="strategies" element={<Strategies />} />
          <Route path="risk" element={<Risk />} />
          <Route path="decision" element={<Decision />} />
          <Route path="report" element={<Report />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
