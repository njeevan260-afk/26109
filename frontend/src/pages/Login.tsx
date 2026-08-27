import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getDashboardPath } from '../auth/dashboardPath';

export default function Login() {
  const { session, identity, loading, configurationError, authError, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session && identity?.account_status === 'ACTIVE') {
    return <Navigate to={getDashboardPath(identity)} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      const requestedPath = (location.state as { from?: string } | null)?.from;
      navigate(requestedPath || '/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-brand-bg p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
        <Link className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-brand-text-secondary hover:text-brand-teal" to="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to homepage
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-brand-teal/10 p-3 text-brand-teal">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Sign in to HerdVitals</h1>
            <p className="text-sm text-brand-text-secondary">Secure access is controlled by your approved role.</p>
          </div>
        </div>

        {(configurationError || error || authError) && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">
            {configurationError || error || authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium text-brand-navy">
            Email
            <input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-brand-navy">
            Password
            <input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
          </label>
          <button disabled={submitting || Boolean(configurationError)} className="w-full rounded-lg bg-brand-teal px-4 py-2.5 font-bold text-white disabled:opacity-50" type="submit">
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-brand-text-secondary">
          Need access? <Link className="font-bold text-brand-teal hover:underline" to="/register">Request an account</Link>
        </p>
      </div>
    </main>
  );
}
