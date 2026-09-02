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
import { useTranslation } from 'react-i18next';

const roleLabelKeys: Record<AppRole, string> = {
  ADMIN: 'roles.admin',
  DAIRY_FARMER: 'roles.farmer',
  VETERINARIAN: 'roles.veterinarian',
  DAIRY_COOPERATIVE: 'roles.cooperative',
  ANIMAL_HEALTH_AUTHORITY: 'roles.authority',
};

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
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
      console.error(loadError);
      setError(t('adminPage.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

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
      setMessage(t('adminPage.decisionMessage', {
        name: request.display_name || request.email || t('adminPage.applicant'),
        decision: decision === 'APPROVE' ? t('adminPage.approved') : t('adminPage.rejected'),
      }));
    } catch (decisionError) {
      console.error(decisionError);
      setError(t('adminPage.processError'));
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
              <ShieldCheck className="h-5 w-5" aria-hidden="true" /> {t('adminPage.secureAdmin')}
            </div>
            <h1 className="text-3xl font-bold">{t('adminPage.welcome', { name: identity.display_name || t('roles.admin') })}</h1>
            <p className="mt-2 max-w-2xl text-slate-200">{t('adminPage.subtitle')}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-slate-300">{t('adminPage.liveQueue')}</p>
            <div className="mt-1 flex items-center gap-2 font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${realtimeStatus === 'SUBSCRIBED' ? 'bg-emerald-300' : 'bg-amber-300'}`} />
              {realtimeStatus === 'SUBSCRIBED' ? t('adminPage.realtimeConnected') : t('adminPage.pollingActive')}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('adminPage.accountStats')}>
        {[
          { label: t('adminPage.waitingApproval'), value: pending.length, icon: Clock3, color: 'text-amber-600 bg-amber-50' },
          { label: t('adminPage.activeAccounts'), value: activeCount, icon: UserCheck, color: 'text-emerald-700 bg-emerald-50' },
          { label: t('adminPage.suspendedRejected'), value: suspendedCount, icon: X, color: 'text-red-600 bg-red-50' },
          { label: t('adminPage.totalUsers'), value: requests.length, icon: Users, color: 'text-brand-teal bg-brand-teal/10' },
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
            <h2 className="text-xl font-bold text-brand-navy">{t('adminPage.waitingList')}</h2>
            <p className="text-sm text-brand-text-secondary">{t('adminPage.approvalHint')}</p>
          </div>
          <button type="button" onClick={() => void loadRequests(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-brand-navy disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> {t('common.refresh')}
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-brand-text-secondary">{t('adminPage.loadingQueue')}</div>
        ) : pending.length === 0 ? (
          <div className="p-10 text-center">
            <Check className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
            <p className="mt-3 font-bold text-brand-navy">{t('adminPage.allCaughtUp')}</p>
            <p className="mt-1 text-sm text-brand-text-secondary">{t('adminPage.newRequests')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pending.map(request => (
              <article key={request.user_id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-brand-teal/10 p-2.5 text-brand-teal"><Building2 className="h-5 w-5" aria-hidden="true" /></div>
                  <div>
                    <p className="font-bold text-brand-navy">{request.display_name || t('adminPage.unnamedApplicant')}</p>
                    <p className="text-sm text-brand-text-secondary">{request.email || t('adminPage.emailUnavailable')}</p>
                    {request.phone_number && <p className="text-sm text-brand-text-secondary">{request.phone_number}</p>}
                    <p className="text-sm text-brand-text-secondary">{request.organization_name || t('adminPage.independentApplicant')}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-text-secondary">{t('adminPage.requestedAccess')}</p>
                  <p className="mt-1 font-bold text-brand-navy">{t(roleLabelKeys[request.role])}</p>
                  <p className="mt-1 text-xs text-brand-text-secondary">{t('adminPage.submitted', { time: new Date(request.created_at).toLocaleString(locale) })}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={processingUser === request.user_id} onClick={() => void handleDecision(request, 'REJECT')} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50">{t('adminPage.reject')}</button>
                  <button type="button" disabled={processingUser === request.user_id} onClick={() => void handleDecision(request, 'APPROVE')} className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{processingUser === request.user_id ? t('adminPage.processing') : t('adminPage.approve')}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-brand-teal" aria-hidden="true" /><h2 className="text-xl font-bold text-brand-navy">{t('adminPage.roleDirectory')}</h2></div>
          <p className="mt-1 text-sm text-brand-text-secondary">{t('adminPage.directoryHint')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-brand-text-secondary"><tr><th className="px-5 py-3">{t('adminPage.user')}</th><th className="px-5 py-3">{t('adminPage.organization')}</th><th className="px-5 py-3">{t('adminPage.role')}</th><th className="px-5 py-3">{t('common.status')}</th><th className="px-5 py-3">{t('adminPage.updated')}</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map(request => (
                <tr key={request.user_id}>
                  <td className="px-5 py-4"><p className="font-semibold text-brand-navy">{request.display_name || t('adminPage.unnamedUser')}</p><p className="text-xs text-brand-text-secondary">{request.email}</p>{request.phone_number && <p className="text-xs text-brand-text-secondary">{request.phone_number}</p>}</td>
                  <td className="px-5 py-4 text-brand-text-secondary">{request.organization_name || '—'}</td>
                  <td className="px-5 py-4 font-medium text-brand-navy">{t(roleLabelKeys[request.role])}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${request.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : request.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{t(`common.${request.status.toLowerCase()}`)}</span></td>
                  <td className="px-5 py-4 text-brand-text-secondary">{new Date(request.updated_at).toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
