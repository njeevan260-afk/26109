import { createClient, SupabaseClient } from '@supabase/supabase-js';

type AuthEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_PUBLIC_SITE_URL?: string;
};

const environment = (import.meta as ImportMeta & { env: AuthEnvironment }).env;
const supabaseUrl = environment.VITE_SUPABASE_URL;
const supabaseKey =
  environment.VITE_SUPABASE_PUBLISHABLE_KEY ||
  environment.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getAuthRedirectUrl(path: string): string {
  const configuredSiteUrl = environment.VITE_PUBLIC_SITE_URL?.trim();
  const publicSiteUrl = !configuredSiteUrl || configuredSiteUrl === 'auto'
    ? window.location.origin
    : configuredSiteUrl;
  return new URL(path, publicSiteUrl).toString();
}

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}
