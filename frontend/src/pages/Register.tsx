import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRoundPlus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { AppRole } from '../types';

const roleOptions: { value: AppRole; label: string }[] = [
  { value: 'DAIRY_FARMER', label: 'Dairy farmer' },
  { value: 'VETERINARIAN', label: 'Veterinarian' },
  { value: 'DAIRY_COOPERATIVE', label: 'Dairy cooperative' },
  { value: 'ANIMAL_HEALTH_AUTHORITY', label: 'Animal health authority' },
];

export default function Register() {
  const { configurationError, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [requestedRole, setRequestedRole] = useState<AppRole>('DAIRY_FARMER');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await signUp({
        email,
        password,
        displayName,
        organizationName,
        requestedRole,
      });
      setSuccess(result.confirmationRequired
        ? 'Check your email to confirm the account. Role approval is still required afterward.'
        : 'Account created. Your requested role is awaiting administrator approval.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-brand-bg p-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-brand-teal/10 p-3 text-brand-teal"><UserRoundPlus className="h-6 w-6" aria-hidden="true" /></div>
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Request HerdVitals access</h1>
            <p className="text-sm text-brand-text-secondary">Your selected role is reviewed before it grants access.</p>
          </div>
        </div>

        {(configurationError || error) && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">{configurationError || error}</div>}
        {success && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-brand-navy">Full name<input required value={displayName} onChange={event => setDisplayName(event.target.value)} autoComplete="name" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" /></label>
          <label className="space-y-1.5 text-sm font-medium text-brand-navy">Organization<input required value={organizationName} onChange={event => setOrganizationName(event.target.value)} autoComplete="organization" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" /></label>
          <label className="space-y-1.5 text-sm font-medium text-brand-navy">Requested role<select value={requestedRole} onChange={event => setRequestedRole(event.target.value as AppRole)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5">{roleOptions.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
          <label className="space-y-1.5 text-sm font-medium text-brand-navy">Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" /></label>
          <label className="space-y-1.5 text-sm font-medium text-brand-navy sm:col-span-2">Password<input required minLength={8} type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" /></label>
          <button disabled={submitting || Boolean(configurationError)} type="submit" className="rounded-lg bg-brand-teal px-4 py-2.5 font-bold text-white disabled:opacity-50 sm:col-span-2">{submitting ? 'Submitting request...' : 'Create account request'}</button>
        </form>

        <p className="mt-5 text-center text-sm text-brand-text-secondary">Already registered? <Link className="font-bold text-brand-teal hover:underline" to="/login">Sign in</Link></p>
      </div>
    </main>
  );
}
