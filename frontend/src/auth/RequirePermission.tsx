import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RequirePermission({ permission }: { permission: string }) {
  const { identity, hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <Navigate to={identity?.dashboard_path || '/pending'} replace />;
  }
  return <Outlet />;
}
