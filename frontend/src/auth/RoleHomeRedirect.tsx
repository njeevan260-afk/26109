import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getDashboardPath } from './dashboardPath';

export default function RoleHomeRedirect() {
  const { identity } = useAuth();
  return <Navigate to={getDashboardPath(identity)} replace />;
}
