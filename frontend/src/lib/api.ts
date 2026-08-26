import { Animal, Prediction, RiskHistory, SensorReading, HardwareStatus, ClusterFeatureCollection, Alert } from "../types";

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
    ?.VITE_API_URL || "http://localhost:8000";

export const fetchAnimals = async (): Promise<Animal[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/animals`);
    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    return [];
  }
};

export const fetchPrediction = async (animal_id: string): Promise<Prediction | undefined> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/predict/${animal_id}`, {
      method: 'POST'
    });
    if (!response.ok) return undefined;
    return response.json();
  } catch (error) {
    return undefined;
  }
};

export const fetchRiskHistory = async (animal_id: string): Promise<RiskHistory> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/predictions/${animal_id}?limit=10`);
    if (!response.ok) return { animal_id, history: [] };
    return response.json();
  } catch (error) {
    return { animal_id, history: [] };
  }
};

export const fetchSensorReadings = async (animal_id: string): Promise<SensorReading[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sensors/${animal_id}?limit=100`);
    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    return [];
  }
};

export const fetchAlerts = async (): Promise<Alert[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts`);
    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    return [];
  }
};

export const fetchClusters = async (): Promise<ClusterFeatureCollection> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clusters`);
    if (!response.ok) return { type: "FeatureCollection", features: [] };
    return response.json();
  } catch (error) {
    return { type: "FeatureCollection", features: [] };
  }
};

export const fetchHardwareStatus = async (): Promise<HardwareStatus | undefined> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health/hardware`);
    if (!response.ok) return undefined;
    return response.json();
  } catch (error) {
    return undefined;
  }
};

export interface DashboardSummary {
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
  }[];
}
export const fetchDashboardSummary =
  async (): Promise<DashboardSummary | undefined> => {

    try {

      const response = await fetch(
        `${API_BASE_URL}/api/dashboard/summary`
      );

      if (!response.ok) {
        return undefined;
      }

      return response.json();

    } catch (error) {

      console.error(
        "Dashboard summary error:",
        error
      );

      return undefined;
    }
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
