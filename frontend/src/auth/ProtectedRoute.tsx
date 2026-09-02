import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTranslation } from 'react-i18next';

export default function ProtectedRoute() {
  const { session, identity, loading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-brand-bg text-brand-navy">
        <p className="font-semibold">{t('system.validatingSession')}</p>
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!identity || identity.account_status !== 'ACTIVE' || !identity.role) {
    return <Navigate to="/pending" replace />;
  }
  if (!identity.phone_number && location.pathname !== '/profile') {
    return (
      <Navigate
        to="/profile"
        replace
        state={{ profileRequired: true, from: location.pathname }}
      />
    );
  }
  return <Outlet />;
}
