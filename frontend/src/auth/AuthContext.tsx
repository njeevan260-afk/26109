import { Session } from '@supabase/supabase-js';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch } from '../lib/api';
import { getAuthRedirectUrl, supabase, supabaseConfigured } from '../lib/supabase';
import { AppRole, AuthIdentity } from '../types';

interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  phoneNumber: string;
  organizationName: string;
  requestedRole: AppRole;
}

interface ProfileUpdateInput {
  displayName: string;
  phoneNumber: string;
  organizationName: string;
  whatsappAlertsEnabled: boolean;
}

interface AuthContextValue {
  session: Session | null;
  identity: AuthIdentity | null;
  loading: boolean;
  configurationError: string | null;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ confirmationRequired: boolean }>;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  verifyPasswordRecovery: (tokenHash: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadIdentity(session: Session): Promise<AuthIdentity> {
  const response = await apiFetch('/api/auth/me');
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Could not validate your application role');
  }
  return response.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const configurationError = supabaseConfigured
    ? null
    : 'Supabase Auth is not configured in the frontend environment.';

  const applySession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setAuthError(null);
    if (!nextSession) {
      setIdentity(null);
      setLoading(false);
      return;
    }
    try {
      setIdentity(await loadIdentity(nextSession));
    } catch (error) {
      setIdentity(null);
      setAuthError(error instanceof Error ? error.message : 'Could not validate your access');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setSession(null);
        setIdentity(null);
        setAuthError(error.message);
        setLoading(false);
        return;
      }
      void applySession(data.session).catch(() => undefined);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Defer network work until the Supabase auth callback releases its lock.
      window.setTimeout(() => {
        if (active) void applySession(nextSession).catch(() => undefined);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(configurationError || 'Supabase is unavailable');
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      throw error;
    }
    await applySession(data.session);
  }, [applySession, configurationError]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error(configurationError || 'Supabase is unavailable');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl('/app'),
      },
    });
    if (error) throw error;
  }, [configurationError]);

  const signUp = useCallback(async (input: SignUpInput) => {
    if (!supabase) throw new Error(configurationError || 'Supabase is unavailable');
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/login'),
        data: {
          display_name: input.displayName,
          phone_number: input.phoneNumber,
          organization_name: input.organizationName,
          requested_role: input.requestedRole,
        },
      },
    });
    if (error) throw error;
    if (data.session) await applySession(data.session);
    return { confirmationRequired: !data.session };
  }, [applySession, configurationError]);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error(configurationError || 'Supabase is unavailable');
    const redirectTo = getAuthRedirectUrl('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, [configurationError]);

  const updateProfile = useCallback(async (input: ProfileUpdateInput) => {
    if (!supabase || !session) throw new Error(configurationError || 'Supabase is unavailable');
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: input.displayName,
        phone_number: input.phoneNumber,
        whatsapp_alerts_enabled: input.whatsappAlertsEnabled,
        organization_name: input.organizationName || null,
      })
      .eq('id', session.user.id);
    if (error) throw error;
    await applySession(session);
  }, [applySession, configurationError, session]);

  const verifyPasswordRecovery = useCallback(async (tokenHash: string) => {
    if (!supabase) throw new Error(configurationError || 'Supabase is unavailable');
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });
    if (error) throw error;
    await applySession(data.session);
  }, [applySession, configurationError]);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error(configurationError || 'Supabase is unavailable');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, [configurationError]);

  const signOut = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    }
    setSession(null);
    setIdentity(null);
  }, []);

  const refreshIdentity = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    await applySession(session);
  }, [applySession, session]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    identity,
    loading,
    configurationError,
    authError,
    signIn,
    signInWithGoogle,
    signUp,
    updateProfile,
    requestPasswordReset,
    verifyPasswordRecovery,
    updatePassword,
    signOut,
    refreshIdentity,
    hasPermission: permission => Boolean(identity?.permissions.includes(permission)),
  }), [
    configurationError,
    authError,
    identity,
    loading,
    refreshIdentity,
    requestPasswordReset,
    session,
    signIn,
    signInWithGoogle,
    signOut,
    signUp,
    updatePassword,
    updateProfile,
    verifyPasswordRecovery,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
