export type RiskCategory = "NONE" | "LOW" | "MODERATE" | "HIGH";

export interface Animal {
  id: string;
  tag_number: string;
  breed: string;
  lactation_number: number;
  baseline_ec: number;
  baseline_temp: number;
  previous_mastitis_count: number;
  created_at: string;
}

export interface Prediction {
  tag_number: string;
  risk_7day: number; // 0.0 - 1.0
  risk_14day: number;
  category: RiskCategory;
  latest_ec: number;
  latest_temp: number;
  ec_deviation: number;
  temp_deviation: number;
  factors: {
    ec_trend: number;
    temp_deviation: number;
    history: number;
    rolling_avg: number;
  };
  recommendations: string[];
}

export interface RiskHistoryItem {
  prediction_date: string;
  risk_7day: number;
  risk_category: RiskCategory;
  feature_importance: {
    ec_trend?: number;
    temp?: number;
    history?: number;
    rolling_avg?: number;
  };
}

export interface RiskHistory {
  animal_id: string;
  history: RiskHistoryItem[];
}

export interface SensorReading {
  id: string;
  animal_id: string;
  sensor_type: "EC" | "TEMP";
  value: number;
  unit: string;
  reading_time: string;
  is_simulated: boolean;
  device_id: string;
}

export interface HardwareStatus {
  status: "online" | "offline";
  device_id: string;
  signal_strength: number;
  battery: number;
  last_reading: string;
}

export interface ClusterFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    cluster_name: string;
    risk_level: RiskCategory;
    affected_cows: string[];
  };
}

export interface ClusterFeatureCollection {
  type: "FeatureCollection";
  features: ClusterFeature[];
}

export interface Alert {
  id: string;
  animal_id: string;
  severity: "MODERATE" | "HIGH";
  message: string;
  created_at: string;
  status: "UNRESOLVED" | "RESOLVED";
}
