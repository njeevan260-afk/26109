import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute() {
  const { session, identity, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-brand-bg text-brand-navy">
        <p className="font-semibold">Validating secure session...</p>
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!identity || identity.account_status !== 'ACTIVE' || !identity.role) {
    return <Navigate to="/pending" replace />;
  }
  return <Outlet />;
}
