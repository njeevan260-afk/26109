import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { milkFederations, normalizePhoneNumber, profileAffiliation } from '../lib/profile';

const roleLabels = {
  ADMIN: 'Administrator',
  DAIRY_FARMER: 'Dairy farmer',
  VETERINARIAN: 'Veterinarian',
  DAIRY_COOPERATIVE: 'Dairy cooperative',
  ANIMAL_HEALTH_AUTHORITY: 'Animal health authority',
};

interface ProfileLocationState {
  profileRequired?: boolean;
  from?: string;
}

export default function Profile() {
  const { identity, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as ProfileLocationState;
  const [displayName, setDisplayName] = useState(identity?.display_name || '');
  const [phoneNumber, setPhoneNumber] = useState(identity?.phone_number || '');
  const [organizationName, setOrganizationName] = useState(identity?.organization_name || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const role = identity?.role || identity?.requested_role;
  const affiliation = useMemo(() => profileAffiliation(role), [role]);

  useEffect(() => {
    setDisplayName(identity?.display_name || '');
    setPhoneNumber(identity?.phone_number || '');
    setOrganizationName(identity?.organization_name || '');
  }, [identity]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (affiliation?.required && !organizationName.trim()) {
        throw new Error('Select your dairy cooperative federation.');
      }
      await updateProfile({
        displayName: displayName.trim(),
        phoneNumber: normalizedPhone,
        organizationName: role === 'DAIRY_FARMER' ? '' : organizationName.trim(),
      });
      setPhoneNumber(normalizedPhone);
      setSuccess('Your profile has been updated. This number can be used for future SMS alerts.');
      if (state.profileRequired) {
        navigate(state.from && state.from !== '/profile' ? state.from : '/app', { replace: true });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not update your profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-brand-navy via-slate-800 to-brand-teal p-7 text-white shadow-lg">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white/10 p-3"><UserRound className="h-7 w-7" aria-hidden="true" /></div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">Account profile</p>
            <h1 className="mt-1 text-3xl font-bold">Your contact details</h1>
            <p className="mt-2 text-slate-200">Keep your phone number current so HerdVitals can support real-time SMS alerts in the future.</p>
          </div>
        </div>
      </section>

      {!identity?.phone_number && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <Phone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div><p className="font-bold">Phone number required</p><p className="text-sm">Complete your profile before continuing to the dashboard.</p></div>
        </div>
      )}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">{error}</div>}
      {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5" aria-hidden="true" />{success}</div>}

      <form onSubmit={handleSubmit} className="grid gap-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium text-brand-navy">Full name<input required value={displayName} onChange={event => setDisplayName(event.target.value)} autoComplete="name" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" /></label>
        <label className="space-y-1.5 text-sm font-medium text-brand-navy">Email<input disabled value={identity?.email || ''} autoComplete="email" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-brand-text-secondary" /></label>
        <label className="space-y-1.5 text-sm font-medium text-brand-navy">Phone number<input required type="tel" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" /></label>
        <label className="space-y-1.5 text-sm font-medium text-brand-navy">Approved role<div className="flex min-h-[46px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-brand-text-secondary"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{role ? roleLabels[role] : 'Pending'}</div></label>

        {affiliation && role === 'DAIRY_COOPERATIVE' && (
          <label className="space-y-1.5 text-sm font-medium text-brand-navy sm:col-span-2">{affiliation.label}<select required value={organizationName} onChange={event => setOrganizationName(event.target.value)} autoComplete="organization" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5"><option value="">Select a milk federation</option>{milkFederations.map(federation => <option key={federation} value={federation}>{federation}</option>)}</select></label>
        )}
        {affiliation && role !== 'DAIRY_COOPERATIVE' && (
          <label className="space-y-1.5 text-sm font-medium text-brand-navy sm:col-span-2">{affiliation.label} <span className="font-normal text-brand-text-secondary">(optional)</span><input value={organizationName} onChange={event => setOrganizationName(event.target.value)} autoComplete="organization" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" /></label>
        )}

        <button disabled={submitting} type="submit" className="rounded-lg bg-brand-teal px-4 py-2.5 font-bold text-white disabled:opacity-50 sm:col-span-2">{submitting ? 'Saving profile...' : 'Save profile'}</button>
      </form>
    </div>
  );
}
