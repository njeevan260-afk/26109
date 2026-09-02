import { ArrowRight, Building2, HeartPulse, Landmark, Tractor } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppRole } from '../types';
import { useTranslation } from 'react-i18next';

const roleContent = {
  ADMIN: {
    titleKey: 'rolePage.adminTitle',
    descriptionKey: 'rolePage.adminDescription',
    icon: Landmark,
  },
  DAIRY_FARMER: {
    titleKey: 'rolePage.farmerTitle',
    descriptionKey: 'rolePage.farmerDescription',
    icon: Tractor,
  },
  VETERINARIAN: {
    titleKey: 'rolePage.veterinarianTitle',
    descriptionKey: 'rolePage.veterinarianDescription',
    icon: HeartPulse,
  },
  DAIRY_COOPERATIVE: {
    titleKey: 'rolePage.cooperativeTitle',
    descriptionKey: 'rolePage.cooperativeDescription',
    icon: Building2,
  },
  ANIMAL_HEALTH_AUTHORITY: {
    titleKey: 'rolePage.authorityTitle',
    descriptionKey: 'rolePage.authorityDescription',
    icon: Landmark,
  },
} satisfies Record<AppRole, { titleKey: string; descriptionKey: string; icon: typeof Tractor }>;

export default function RoleDashboard({ requiredRole }: { requiredRole: AppRole }) {
  const { t } = useTranslation();
  const { identity } = useAuth();
  if (!identity?.role) return <Navigate to="/pending" replace />;
  if (identity.role !== requiredRole) return <Navigate to={identity.dashboard_path} replace />;

  const content = roleContent[requiredRole];
  const Icon = content.icon;
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl bg-brand-navy p-7 text-white shadow-sm">
        <Icon className="mb-4 h-10 w-10 text-brand-teal" aria-hidden="true" />
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-teal">{t('rolePage.workspace')}</p>
        <h1 className="mt-1 text-3xl font-bold">{t(content.titleKey)}</h1>
        <p className="mt-3 max-w-2xl text-gray-200">{t(content.descriptionKey)}</p>
      </div>
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8">
        <h2 className="text-xl font-bold text-brand-navy">{t('rolePage.nextMilestone')}</h2>
        <p className="mt-2 text-brand-text-secondary">{t('rolePage.placeholder')}</p>
        <Link to="/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-teal px-4 py-2.5 font-bold text-white">{t('rolePage.openDashboard')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
