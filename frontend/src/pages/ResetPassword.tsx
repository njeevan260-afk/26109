import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export default function ResetPassword() {
  const {
    session,
    loading,
    configurationError,
    verifyPasswordRecovery,
    updatePassword,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const callbackParameters = new URLSearchParams(window.location.search);
  const tokenHash = callbackParameters.get('token_hash');
  const callbackError = callbackParameters.get('error_description');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(Boolean(tokenHash));
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [error, setError] = useState<string | null>(callbackError);

  useEffect(() => {
    if (!tokenHash) return;

    let active = true;
    void verifyPasswordRecovery(tokenHash)
      .then(() => {
        if (!active) return;
        setRecoveryVerified(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not verify the password-reset link');
        }
      })
      .finally(() => {
        if (active) setVerifying(false);
      });

    return () => {
      active = false;
    };
  }, [tokenHash, verifyPasswordRecovery]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      await signOut();
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-brand-bg p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-brand-teal/10 p-3 text-brand-teal">
            <KeyRound className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Set a new password</h1>
            <p className="text-sm text-brand-text-secondary">Choose a secure password with at least 8 characters.</p>
          </div>
        </div>

        {(configurationError || error) && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">
            {configurationError || error}
          </div>
        )}

        {loading || verifying ? (
          <div role="status" className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-brand-text-secondary">
            Verifying your password-reset link...
          </div>
        ) : !session && !recoveryVerified ? (
          <div className="space-y-4">
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This reset link is invalid or has expired. Request a new link from the sign-in page.
            </div>
            <Link className="block text-center text-sm font-bold text-brand-teal hover:underline" to="/login">
              Return to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium text-brand-navy">
              New password
              <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-brand-navy">
              Confirm new password
              <input required minLength={8} type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
            </label>
            <button disabled={loading || submitting || Boolean(configurationError)} className="w-full rounded-lg bg-brand-teal px-4 py-2.5 font-bold text-white disabled:opacity-50" type="submit">
              {submitting ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
