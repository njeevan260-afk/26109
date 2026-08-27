import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import HerdManagement from './pages/HerdManagement';
import AnimalProfile from './pages/AnimalProfile';
import AnalyticsGIS from './pages/AnalyticsGIS';
import AlertsCenter from './pages/AlertsCenter';
import ClinicalEvents from './pages/ClinicalEvents';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import RoleHomeRedirect from './auth/RoleHomeRedirect';
import Login from './pages/Login';
import Register from './pages/Register';
import PendingApproval from './pages/PendingApproval';
import RequirePermission from './auth/RequirePermission';
import { useTranslation } from 'react-i18next';
import AdminDashboard from './pages/AdminDashboard';
import HomePage from './pages/HomePage';
import RealReadings from './pages/RealReadings';

function App() {
  const { t } = useTranslation();
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending" element={<PendingApproval />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<RoleHomeRedirect />} />
            <Route element={<Layout />}>
              <Route path="portal/admin" element={<AdminDashboard />} />
              <Route path="portal/farmer" element={<Navigate to="/dashboard" replace />} />
              <Route path="portal/veterinarian" element={<Navigate to="/dashboard" replace />} />
              <Route path="portal/cooperative" element={<Navigate to="/dashboard" replace />} />
              <Route path="portal/authority" element={<Navigate to="/dashboard" replace />} />
              <Route element={<RequirePermission permission="dashboard.read" />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="real-readings" element={<RealReadings />} />
              </Route>
              <Route element={<RequirePermission permission="animals.read" />}>
                <Route path="herd" element={<HerdManagement />} />
                <Route path="animal/:id" element={<AnimalProfile />} />
              </Route>
              <Route element={<RequirePermission permission="clusters.read" />}>
                <Route path="analytics" element={<AnalyticsGIS />} />
              </Route>
              <Route element={<RequirePermission permission="alerts.read" />}>
                <Route path="alerts" element={<AlertsCenter />} />
              </Route>
              <Route element={<RequirePermission permission="events.read" />}>
                <Route path="events" element={<ClinicalEvents />} />
              </Route>
              <Route path="settings" element={<div className="p-8 text-center text-gray-500">{t('settings')}</div>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
