import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Check,
  Clock3,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  decideAdminRoleRequest,
  fetchAdminRoleRequests,
  subscribeToAdminRoleRequests,
} from '../lib/api';
import { AdminDecision, AdminRoleRequest, AppRole } from '../types';

const roleLabels: Record<AppRole, string> = {
  ADMIN: 'Administrator',
  DAIRY_FARMER: 'Dairy farmer',
  VETERINARIAN: 'Veterinarian',
  DAIRY_COOPERATIVE: 'Dairy cooperative',
  ANIMAL_HEALTH_AUTHORITY: 'Animal health authority',
};

export default function AdminDashboard() {
  const { identity } = useAuth();
  const [requests, setRequests] = useState<AdminRoleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING');

  const loadRequests = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      setRequests(await fetchAdminRoleRequests());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load role requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
    const unsubscribe = subscribeToAdminRoleRequests(
      () => void loadRequests(true),
      setRealtimeStatus,
    );
    const fallback = window.setInterval(() => void loadRequests(true), 30_000);
    return () => {
      unsubscribe();
      window.clearInterval(fallback);
    };
  }, [loadRequests]);

  const pending = useMemo(
    () => requests.filter(request => request.status === 'PENDING'),
    [requests],
  );
  const activeCount = requests.filter(request => request.status === 'ACTIVE').length;
  const suspendedCount = requests.filter(request => request.status === 'SUSPENDED').length;

  if (identity?.role !== 'ADMIN') {
    return <Navigate to={identity?.dashboard_path || '/pending'} replace />;
  }

  const handleDecision = async (request: AdminRoleRequest, decision: AdminDecision) => {
    setProcessingUser(request.user_id);
    setError(null);
    setMessage(null);
    try {
      const updated = await decideAdminRoleRequest(request.user_id, decision);
      setRequests(current => current.map(row => row.user_id === updated.user_id ? updated : row));
      setMessage(`${request.display_name || request.email || 'Applicant'} was ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Could not process request');
    } finally {
      setProcessingUser(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-navy via-slate-800 to-brand-teal p-7 text-white shadow-lg">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Secure administration
            </div>
            <h1 className="text-3xl font-bold">Welcome, {identity.display_name || 'Administrator'}</h1>
            <p className="mt-2 max-w-2xl text-slate-200">Review access requests, govern operational roles, and monitor the HerdVitals platform from one protected workspace.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-slate-300">Live queue</p>
            <div className="mt-1 flex items-center gap-2 font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${realtimeStatus === 'SUBSCRIBED' ? 'bg-emerald-300' : 'bg-amber-300'}`} />
              {realtimeStatus === 'SUBSCRIBED' ? 'Realtime connected' : 'Polling fallback active'}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Account statistics">
        {[
          { label: 'Waiting approval', value: pending.length, icon: Clock3, color: 'text-amber-600 bg-amber-50' },
          { label: 'Active accounts', value: activeCount, icon: UserCheck, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Suspended / rejected', value: suspendedCount, icon: X, color: 'text-red-600 bg-red-50' },
          { label: 'Total governed users', value: requests.length, icon: Users, color: 'text-brand-teal bg-brand-teal/10' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className={`mb-4 inline-flex rounded-xl p-2.5 ${card.color}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
              <p className="text-3xl font-bold text-brand-navy">{card.value}</p>
              <p className="mt-1 text-sm text-brand-text-secondary">{card.label}</p>
            </article>
          );
        })}
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold text-brand-navy">Waiting list</h2>
            <p className="text-sm text-brand-text-secondary">Veterinarians, cooperatives, and authorities require explicit approval.</p>
          </div>
          <button type="button" onClick={() => void loadRequests(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-brand-navy disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-brand-text-secondary">Loading secure approval queue...</div>
        ) : pending.length === 0 ? (
          <div className="p-10 text-center">
            <Check className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
            <p className="mt-3 font-bold text-brand-navy">All caught up</p>
            <p className="mt-1 text-sm text-brand-text-secondary">New requests will appear here automatically.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pending.map(request => (
              <article key={request.user_id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-brand-teal/10 p-2.5 text-brand-teal"><Building2 className="h-5 w-5" aria-hidden="true" /></div>
                  <div>
                    <p className="font-bold text-brand-navy">{request.display_name || 'Unnamed applicant'}</p>
                    <p className="text-sm text-brand-text-secondary">{request.email || 'Email unavailable'}</p>
                    <p className="text-sm text-brand-text-secondary">{request.organization_name || 'Independent applicant'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-secondary">Requested access</p>
                  <p className="mt-1 font-bold text-brand-navy">{roleLabels[request.role]}</p>
                  <p className="mt-1 text-xs text-brand-text-secondary">Submitted {new Date(request.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={processingUser === request.user_id} onClick={() => void handleDecision(request, 'REJECT')} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50">Reject</button>
                  <button type="button" disabled={processingUser === request.user_id} onClick={() => void handleDecision(request, 'APPROVE')} className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{processingUser === request.user_id ? 'Processing...' : 'Approve'}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-brand-teal" aria-hidden="true" /><h2 className="text-xl font-bold text-brand-navy">Role directory</h2></div>
          <p className="mt-1 text-sm text-brand-text-secondary">Current status of every governed application account.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-brand-text-secondary"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Organization</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Updated</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map(request => (
                <tr key={request.user_id}>
                  <td className="px-5 py-4"><p className="font-semibold text-brand-navy">{request.display_name || 'Unnamed user'}</p><p className="text-xs text-brand-text-secondary">{request.email}</p></td>
                  <td className="px-5 py-4 text-brand-text-secondary">{request.organization_name || '—'}</td>
                  <td className="px-5 py-4 font-medium text-brand-navy">{roleLabels[request.role]}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${request.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : request.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{request.status}</span></td>
                  <td className="px-5 py-4 text-brand-text-secondary">{new Date(request.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
