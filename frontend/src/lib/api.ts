import { Animal, Prediction, RiskHistory, SensorReading, HardwareStatus, ClusterFeatureCollection, Alert, MastitisEvent, MastitisEventInput, AdminDecision, AdminRoleRequest } from "../types";
import { getAccessToken, supabase } from './supabase';

const configuredApiUrl =
  (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
    ?.VITE_API_URL?.trim();

const API_BASE_URL = !configuredApiUrl || configuredApiUrl === 'auto'
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : configuredApiUrl.replace(/\/+$/, '');

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const accessToken = await getAccessToken();
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

export const fetchAnimals = async (): Promise<Animal[]> => {
  try {
    const response = await apiFetch('/api/animals');
    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    return [];
  }
};

export const fetchPrediction = async (animal_id: string): Promise<Prediction | undefined> => {
  try {
    const response = await apiFetch(`/api/predict/${animal_id}`);
    if (!response.ok) return undefined;
    return response.json();
  } catch (error) {
    return undefined;
  }
};

export const recomputePrediction = async (animal_id: string): Promise<Prediction> => {
  const response = await apiFetch(`/api/predict/${animal_id}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Could not save the refreshed prediction');
  }
  return response.json();
};

export const fetchRiskHistory = async (animal_id: string): Promise<RiskHistory> => {
  try {
    const response = await apiFetch(`/api/predictions/${animal_id}?limit=10`);
    if (!response.ok) return { animal_id, history: [] };
    return response.json();
  } catch (error) {
    return { animal_id, history: [] };
  }
};

export const fetchSensorReadings = async (animal_id: string): Promise<SensorReading[]> => {
  try {
    const response = await apiFetch(`/api/sensors/${animal_id}?limit=100`);
    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    return [];
  }
};

export const fetchRealSensorReadings = async (limit = 500): Promise<SensorReading[]> => {
  const response = await apiFetch(`/api/sensors/real-readings?limit=${limit}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Could not load real sensor readings');
  }
  return response.json();
};

export const fetchAlerts = async (): Promise<Alert[]> => {
  try {
    const response = await apiFetch('/api/alerts');
    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    return [];
  }
};

export const resolveAlert = async (alertId: string): Promise<Alert> => {
  const response = await apiFetch(`/api/alerts/${alertId}/resolve`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Could not resolve the alert');
  }
  return response.json();
};

export const fetchMastitisEvents = async (): Promise<MastitisEvent[]> => {
  const response = await apiFetch('/api/mastitis-events?limit=100');
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Could not load clinical events');
  }
  return response.json();
};

export const createMastitisEvent = async (
  event: MastitisEventInput,
): Promise<MastitisEvent> => {
  const response = await apiFetch('/api/mastitis-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = Array.isArray(payload.detail)
      ? payload.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(', ')
      : payload.detail;
    throw new Error(detail || 'Could not save the clinical event');
  }
  return response.json();
};

export const fetchClusters = async (): Promise<ClusterFeatureCollection> => {
  try {
    const response = await apiFetch('/api/clusters');
    if (!response.ok) return { type: "FeatureCollection", features: [] };
    return response.json();
  } catch (error) {
    return { type: "FeatureCollection", features: [] };
  }
};

export const fetchHardwareStatus = async (): Promise<HardwareStatus | undefined> => {
  try {
    const response = await apiFetch('/api/health/hardware');
    if (!response.ok) return undefined;
    return response.json();
  } catch (error) {
    return undefined;
  }
};

export interface DashboardSummary {
  generated_at: string;
  history_through: string;
  total_cows: number;
  high_risk_7day: number;
  moderate_high_14day: number;
  herd_risk_index: number;

  risk_distribution: {
    HIGH: number;
    MODERATE: number;
    LOW: number;
    NONE: number;
  };

  risk_history: {
    prediction_date: string;
    risk_7day: number;
    is_current_snapshot: boolean;
  }[];
}
export const fetchDashboardSummary =
  async (): Promise<DashboardSummary | undefined> => {

    try {

      const response = await apiFetch('/api/dashboard/summary');

      if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);

      return response.json();

    } catch (error) {
      console.error("Dashboard summary error:", error);
      throw error;
    }
  };

export const fetchAdminRoleRequests = async (): Promise<AdminRoleRequest[]> => {
  const response = await apiFetch('/api/admin/role-requests');
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Could not load the role approval queue');
  }
  return response.json();
};

export const decideAdminRoleRequest = async (
  userId: string,
  decision: AdminDecision,
): Promise<AdminRoleRequest> => {
  const response = await apiFetch(`/api/admin/role-requests/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Could not process the role request');
  }
  return response.json();
};

export const subscribeToAdminRoleRequests = (
  onChange: () => void,
  onStatus: (status: string) => void,
) => {
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel('admin-role-request-updates')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_roles' },
      () => onChange(),
    )
    .subscribe(status => onStatus(status));

  return () => {
    void supabase.removeChannel(channel);
  };
};
// Realtime subscription placeholder - To be connected with Supabase JS Client
export const subscribeToSensors = (callback: (reading: SensorReading) => void) => {
  console.log("subscribeToSensors: Waiting for Supabase client implementation.");
  
  /* Example Implementation:
  const subscription = supabase
    .channel('sensor_readings')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_readings' }, payload => {
      callback(payload.new as SensorReading);
    })
    .subscribe();
  
  return () => { supabase.removeChannel(subscription); };
  */
  
  return () => {};
};
