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
  model_mode?: "random_forest" | "heuristic" | "unavailable";
  data_source?: "simulated" | "live" | "unavailable";
  note?: string;
  persisted?: boolean;
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
  quality_flag?: string | null;
  tag_number?: string | null;
  breed?: string | null;
}

export interface HardwareStatus {
  status: "online" | "offline";
  device_id: string;
  signal_strength: number;
  battery: number | null;
  last_reading: string | null;
  age_minutes?: number;
  data_source?: "simulated" | "live" | "unavailable";
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
  tag_number?: string;
  breed?: string;
  severity: "MODERATE" | "HIGH";
  message: string;
  created_at: string;
  status: "UNRESOLVED" | "RESOLVED";
}

export type MastitisEventStatus = "SUSPECTED" | "CONFIRMED" | "DISMISSED";
export type DiagnosisMethod =
  | "CLINICAL_EXAM"
  | "CMT"
  | "SCC"
  | "CULTURE"
  | "TREATMENT_RECORD"
  | "OTHER";

export interface MastitisEvent {
  id: string;
  animal_id: string;
  event_time: string;
  status: MastitisEventStatus;
  diagnosis_method: DiagnosisMethod;
  diagnosis_result?: string | null;
  cmt_result?: string | null;
  scc_value?: number | null;
  clinical_signs: string[];
  confirmed_by?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface MastitisEventInput {
  animal_id: string;
  event_time: string;
  status: MastitisEventStatus;
  diagnosis_method: DiagnosisMethod;
  diagnosis_result?: string;
  cmt_result?: string;
  scc_value?: number;
  clinical_signs: string[];
  confirmed_by?: string;
  notes?: string;
}

export type AppRole =
  | "ADMIN"
  | "DAIRY_FARMER"
  | "VETERINARIAN"
  | "DAIRY_COOPERATIVE"
  | "ANIMAL_HEALTH_AUTHORITY";

export type AccountStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export interface AuthIdentity {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  phone_number?: string | null;
  organization_name?: string | null;
  requested_role?: AppRole | null;
  role?: AppRole | null;
  account_status: AccountStatus;
  permissions: string[];
  dashboard_path: string;
}

export interface AdminRoleRequest {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  phone_number?: string | null;
  organization_name?: string | null;
  requested_role?: AppRole | null;
  role: AppRole;
  status: AccountStatus;
  assigned_by?: string | null;
  assigned_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type AdminDecision = "APPROVE" | "REJECT";
