import { Navigate, useNavigate } from 'react-router-dom';
import { Clock3 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getDashboardPath } from '../auth/dashboardPath';

export default function PendingApproval() {
  const { session, identity, loading, authError, refreshIdentity, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  if (loading) return <main className="min-h-screen grid place-items-center bg-brand-bg">Checking approval...</main>;
  if (!session) return <Navigate to="/login" replace />;
  if (identity?.account_status === 'ACTIVE' && identity.role) {
    return <Navigate to={getDashboardPath(identity)} replace />;
  }

  return (
    <main className="min-h-screen grid place-items-center bg-brand-bg p-4">
      <div className="max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <Clock3 className="mx-auto mb-4 h-12 w-12 text-brand-yellow" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-brand-navy">Role approval pending</h1>
        <p className="mt-3 text-brand-text-secondary">Your identity is verified, but the requested role must be approved before operational data is available.</p>
        {authError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">{authError}</div>}
        <dl className="mt-5 rounded-xl bg-gray-50 p-4 text-left text-sm">
          <div className="flex justify-between gap-3"><dt>Email</dt><dd className="font-semibold">{identity?.email || 'Unavailable'}</dd></div>
          <div className="mt-2 flex justify-between gap-3"><dt>Requested role</dt><dd className="font-semibold">{identity?.requested_role?.replaceAll('_', ' ') || 'Not recorded'}</dd></div>
          <div className="mt-2 flex justify-between gap-3"><dt>Status</dt><dd className="font-semibold">{identity?.account_status || 'PENDING'}</dd></div>
        </dl>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={() => void refreshIdentity().catch(() => undefined)} className="rounded-lg bg-brand-teal px-4 py-2 font-bold text-white">Check again</button>
          <button onClick={() => void handleSignOut()} className="rounded-lg border border-gray-200 px-4 py-2 font-bold text-brand-navy">Sign out</button>
        </div>
      </div>
    </main>
  );
}
