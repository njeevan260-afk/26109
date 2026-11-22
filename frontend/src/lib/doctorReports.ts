import { supabase } from './supabase';
import { ActiveVeterinarian, DoctorReport, DoctorReportStatus } from '../types';

/**
 * Fetch active, verified veterinarians from Supabase.
 * Respects RLS: only approved active veterinarians are visible.
 */
export async function fetchActiveVeterinarians(): Promise<ActiveVeterinarian[]> {
  if (!supabase) return [];

  try {
    const { data: viewData, error: viewError } = await supabase
      .from('active_veterinarians')
      .select('id, display_name, organization_name, locality, created_at')
      .order('display_name', { ascending: true });

    if (!viewError && Array.isArray(viewData)) {
      return viewData;
    }
  } catch {
    // Fall back to querying profiles directly
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, organization_name, locality, created_at')
    .eq('requested_role', 'VETERINARIAN')
    .order('display_name', { ascending: true });

  if (error) {
    console.error('Could not fetch active veterinarians:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    display_name: row.display_name,
    organization_name: row.organization_name,
    locality: row.locality ?? null,
    created_at: row.created_at,
  }));
}

/**
 * Submit a clinical consultation report for an affected cow.
 */
export async function createDoctorReport(input: {
  cow_id: string;
  veterinarian_id: string;
  description: string;
}): Promise<DoctorReport> {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('You must be signed in to submit a report');
  }

  const farmer_id = sessionData.session.user.id;

  const { data, error } = await supabase
    .from('doctor_reports')
    .insert({
      farmer_id,
      cow_id: input.cow_id,
      veterinarian_id: input.veterinarian_id,
      description: input.description.trim(),
      status: 'submitted',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Could not submit report to doctor');
  }

  return data;
}

/**
 * Fetch all reports submitted by the current authenticated farmer.
 * Protected by RLS: farmer can only read their own reports.
 */
export async function fetchFarmerReports(): Promise<DoctorReport[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('doctor_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Could not fetch farmer reports:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch all reports assigned to the current authenticated veterinarian.
 * Protected by RLS: veterinarian can only read assigned reports.
 */
export async function fetchVeterinarianReports(): Promise<DoctorReport[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('doctor_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Could not fetch veterinarian reports:', error);
    return [];
  }

  return data || [];
}

/**
 * Update the status of an assigned doctor report.
 */
export async function updateDoctorReportStatus(
  reportId: string,
  status: DoctorReportStatus,
): Promise<DoctorReport> {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase
    .from('doctor_reports')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Could not update report status');
  }

  return data;
}

/**
 * Listen for realtime updates on doctor_reports.
 */
export function subscribeToDoctorReports(onChange: () => void): () => void {
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel('doctor-reports-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'doctor_reports' },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void supabase?.removeChannel(channel);
  };
}
