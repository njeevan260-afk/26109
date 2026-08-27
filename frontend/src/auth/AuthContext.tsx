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
import { supabase, supabaseConfigured } from '../lib/supabase';
import { AppRole, AuthIdentity } from '../types';

interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  organizationName: string;
  requestedRole: AppRole;
}

interface AuthContextValue {
  session: Session | null;
  identity: AuthIdentity | null;
  loading: boolean;
  configurationError: string | null;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ confirmationRequired: boolean }>;
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

  const signUp = useCallback(async (input: SignUpInput) => {
    if (!supabase) throw new Error(configurationError || 'Supabase is unavailable');
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.displayName,
          organization_name: input.organizationName,
          requested_role: input.requestedRole,
        },
      },
    });
    if (error) throw error;
    if (data.session) await applySession(data.session);
    return { confirmationRequired: !data.session };
  }, [applySession, configurationError]);

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
    signUp,
    signOut,
    refreshIdentity,
    hasPermission: permission => Boolean(identity?.permissions.includes(permission)),
  }), [
    configurationError,
    authError,
    identity,
    loading,
    refreshIdentity,
    session,
    signIn,
    signOut,
    signUp,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
