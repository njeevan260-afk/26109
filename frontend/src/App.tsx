import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import HerdManagement from './pages/HerdManagement';
import AnimalProfile from './pages/AnimalProfile';
import AnalyticsGIS from './pages/AnalyticsGIS';
import AlertsCenter from './pages/AlertsCenter';
import ClinicalEvents from './pages/ClinicalEvents';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="herd" element={<HerdManagement />} />
          <Route path="animal/:id" element={<AnimalProfile />} />
          <Route path="analytics" element={<AnalyticsGIS />} />
          <Route path="alerts" element={<AlertsCenter />} />
          <Route path="events" element={<ClinicalEvents />} />
          <Route path="settings" element={<div className="p-8 text-center text-gray-500">Settings coming soon</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
