import { ArrowRight, Building2, HeartPulse, Landmark, Tractor } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppRole } from '../types';

const roleContent = {
  ADMIN: {
    title: 'Administrator Dashboard',
    description: 'Role approvals, account governance, system oversight, and operational access.',
    icon: Landmark,
  },
  DAIRY_FARMER: {
    title: 'Dairy Farmer Dashboard',
    description: 'Your herd, early-warning signals, active alerts, and reported animal-health events.',
    icon: Tractor,
  },
  VETERINARIAN: {
    title: 'Veterinarian Dashboard',
    description: 'Clinical review, diagnostic event confirmation, herd triage, and intervention follow-up.',
    icon: HeartPulse,
  },
  DAIRY_COOPERATIVE: {
    title: 'Dairy Cooperative Dashboard',
    description: 'Cooperative-level herd trends, cluster analytics, operational alerts, and member support.',
    icon: Building2,
  },
  ANIMAL_HEALTH_AUTHORITY: {
    title: 'Animal Health Authority Dashboard',
    description: 'Regional surveillance, model governance, clinical oversight, and programme-level reporting.',
    icon: Landmark,
  },
} satisfies Record<AppRole, { title: string; description: string; icon: typeof Tractor }>;

export default function RoleDashboard({ requiredRole }: { requiredRole: AppRole }) {
  const { identity } = useAuth();
  if (!identity?.role) return <Navigate to="/pending" replace />;
  if (identity.role !== requiredRole) return <Navigate to={identity.dashboard_path} replace />;

  const content = roleContent[requiredRole];
  const Icon = content.icon;
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl bg-brand-navy p-7 text-white shadow-sm">
        <Icon className="mb-4 h-10 w-10 text-brand-teal" aria-hidden="true" />
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-teal">Role workspace</p>
        <h1 className="mt-1 text-3xl font-bold">{content.title}</h1>
        <p className="mt-3 max-w-2xl text-gray-200">{content.description}</p>
      </div>
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8">
        <h2 className="text-xl font-bold text-brand-navy">Dashboard design is the next milestone</h2>
        <p className="mt-2 text-brand-text-secondary">Authentication and authorization are active. This placeholder proves that each approved role reaches only its assigned workspace.</p>
        <Link to="/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-teal px-4 py-2.5 font-bold text-white">Open current operational dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
