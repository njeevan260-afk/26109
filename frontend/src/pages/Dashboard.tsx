import { useEffect, useMemo, useState } from "react";

import {
  fetchDashboardSummary,
  fetchAlerts,
  fetchClusters,
  fetchHardwareStatus,
} from "../lib/api";

import {
  Users,
  AlertTriangle,
  Activity,
  ShieldAlert,
  Wifi,
  WifiOff,
  RefreshCw,
  MapPin,
  Bell,
  TrendingUp,
} from "lucide-react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { Link } from "react-router-dom";

import {
  Alert,
  ClusterFeatureCollection,
  HardwareStatus,
} from "../types";

/* =========================================================
   TYPES
========================================================= */

interface DashboardHistoryItem {
  date?: string;
  prediction_date?: string;
  risk?: number;
  risk_7day?: number;
  value?: number;
}

interface DashboardSummary {
  total_cows?: number;
  total_animals?: number;
  herd_size?: number;

  high_risk?: number;
  high_risk_count?: number;
  high_count?: number;

  moderate_risk?: number;
  moderate_risk_count?: number;
  moderate_count?: number;

  low_risk?: number;
  low_risk_count?: number;
  low_count?: number;

  normal_risk?: number;
  normal_risk_count?: number;
  normal_count?: number;

  none_risk?: number;
  none_risk_count?: number;

  moderate_high?: number;
  moderate_high_count?: number;

  herd_risk_index?: number;
  risk_index?: number;
  herd_risk?: number;

  risk_distribution?: {
    high?: number;
    moderate?: number;
    low?: number;
    normal?: number;
    none?: number;
  };

  herd_risk_history?: DashboardHistoryItem[];

  risk_history?: DashboardHistoryItem[];

  alerts?: Alert[];

  clusters?: ClusterFeatureCollection;

  hardware?: HardwareStatus;
}

/* =========================================================
   HELPERS
========================================================= */

function firstNumber(
  object: DashboardSummary,
  keys: string[],
  fallback = 0
): number {
  for (const key of keys) {
    const value = object[key as keyof DashboardSummary];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return fallback;
}

function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.round(value)}%`;
}

function normalizeRiskValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  /*
   * Backend may return:
   *
   * 0.63
   *
   * OR
   *
   * 63
   *
   * Internally charts use 0-1.
   */

  if (value > 1) {
    return value / 100;
  }

  return value;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Dashboard() {
  const [summary, setSummary] =
    useState<DashboardSummary | null>(null);

  const [alerts, setAlerts] =
    useState<Alert[]>([]);

  const [clusters, setClusters] =
    useState<ClusterFeatureCollection | null>(null);

  const [hardware, setHardware] =
    useState<HardwareStatus | undefined>();

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  async function loadDashboard(
    isRefresh = false
  ) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      /*
       * Main dashboard endpoint.
       *
       * This should provide:
       * - herd statistics
       * - risk distribution
       * - risk history
       *
       * Other endpoints are fetched separately.
       */

      const summaryResponse =
        await fetchDashboardSummary();

      /*
       * Fetch supporting dashboard information.
       *
       * If any of these fail, the summary can
       * still populate the dashboard.
       */

      const [
        alertsResponse,
        clustersResponse,
        hardwareResponse,
      ] = await Promise.all([
        fetchAlerts(),
        fetchClusters(),
        fetchHardwareStatus(),
      ]);

      const normalizedSummary =
        (summaryResponse || {}) as DashboardSummary;

      setSummary(normalizedSummary);

      /*
       * Alerts
       */

      if (
        Array.isArray(alertsResponse)
      ) {
        setAlerts(alertsResponse);
      } else if (
        Array.isArray(normalizedSummary.alerts)
      ) {
        setAlerts(
          normalizedSummary.alerts
        );
      } else {
        setAlerts([]);
      }

      /*
       * Clusters
       */

      if (
        clustersResponse &&
        Array.isArray(
          clustersResponse.features
        )
      ) {
        setClusters(
          clustersResponse
        );
      } else if (
        normalizedSummary.clusters
      ) {
        setClusters(
          normalizedSummary.clusters
        );
      } else {
        setClusters({
          type: "FeatureCollection",
          features: [],
        });
      }

      /*
       * Hardware
       */

      if (hardwareResponse) {
        setHardware(
          hardwareResponse
        );
      } else {
        setHardware(
          normalizedSummary.hardware
        );
      }
    } catch (err) {
      console.error(
        "Dashboard loading error:",
        err
      );

      setError(
        "Unable to load dashboard data. Make sure the FastAPI backend is running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadDashboard();
  }, []);

  /* =======================================================
     NORMALIZE SUMMARY
  ======================================================= */

  const data: DashboardSummary =
    summary || {};

  const totalCows =
    firstNumber(
      data,
      [
        "total_cows",
        "total_animals",
        "herd_size",
      ],
      0
    );

  const highRiskCount =
    firstNumber(
      data,
      [
        "high_risk",
        "high_risk_count",
        "high_count",
      ],
      data.risk_distribution?.high || 0
    );

  const moderateRiskCount =
    firstNumber(
      data,
      [
        "moderate_risk",
        "moderate_risk_count",
        "moderate_count",
      ],
      data.risk_distribution?.moderate || 0
    );

  const lowRiskCount =
    firstNumber(
      data,
      [
        "low_risk",
        "low_risk_count",
        "low_count",
      ],
      data.risk_distribution?.low || 0
    );

  const normalRiskCount =
    firstNumber(
      data,
      [
        "normal_risk",
        "normal_risk_count",
        "none_risk",
        "none_risk_count",
        "normal_count",
      ],
      data.risk_distribution?.normal ??
        data.risk_distribution?.none ??
        0
    );

  const moderateHighCount =
    firstNumber(
      data,
      [
        "moderate_high",
        "moderate_high_count",
      ],
      highRiskCount +
        moderateRiskCount
    );

  const rawHerdRiskIndex =
    firstNumber(
      data,
      [
        "herd_risk_index",
        "risk_index",
        "herd_risk",
      ],
      0
    );

  /*
   * Herd risk index may arrive as:
   *
   * 0.63
   * OR
   * 63
   *
   * Display as percentage.
   */

  const herdRiskIndex =
    rawHerdRiskIndex <= 1
      ? rawHerdRiskIndex * 100
      : rawHerdRiskIndex;

  /* =======================================================
     RISK DISTRIBUTION
  ======================================================= */

  const pieData = useMemo(
    () => [
      {
        name: "High",
        value: highRiskCount,
        color:
          "var(--color-brand-red)",
      },
      {
        name: "Moderate",
        value: moderateRiskCount,
        color:
          "var(--color-brand-yellow)",
      },
      {
        name: "Low",
        value: lowRiskCount,
        color:
          "var(--color-brand-teal)",
      },
      {
        name: "Normal",
        value: normalRiskCount,
        color: "#E2E8F0",
      },
    ],
    [
      highRiskCount,
      moderateRiskCount,
      lowRiskCount,
      normalRiskCount,
    ]
  );

  /* =======================================================
     HERD RISK HISTORY
  ======================================================= */

  const herdRiskHistory =
    useMemo(() => {
      const rawHistory =
        data.herd_risk_history ||
        data.risk_history ||
        [];

      return rawHistory.map(
        (item, index) => {
          const rawRisk =
            item.risk ??
            item.risk_7day ??
            item.value ??
            0;

          const numericRisk =
            typeof rawRisk === "number"
              ? rawRisk
              : Number(rawRisk);

          return {
            index,

            date:
              item.date ||
              item.prediction_date ||
              `Day ${index + 1}`,

            risk:
              normalizeRiskValue(
                numericRisk
              ),
          };
        }
      );
    }, [data]);

  /* =======================================================
     CLUSTERS
  ======================================================= */

  const clusterList =
    clusters?.features || [];

  /* =======================================================
     ACTIVE ALERTS
  ======================================================= */

  const activeAlerts =
    alerts.filter(
      (alert) =>
        alert.status ===
        "UNRESOLVED"
    );

  const displayedAlerts =
    activeAlerts.length > 0
      ? activeAlerts
      : alerts;

  /* =======================================================
     KPI DATA
  ======================================================= */

  const kpis = [
    {
      label: "Total Cows",
      value: loading
        ? "..."
        : totalCows,
      icon: Users,
      color:
        "bg-brand-navy",
    },

    {
      label: "High Risk (7-Day)",
      value: loading
        ? "..."
        : highRiskCount,
      icon: ShieldAlert,
      color:
        "bg-brand-red",
      pulse:
        highRiskCount > 5,
    },

    {
      label: "Moderate + High",
      value: loading
        ? "..."
        : moderateHighCount,
      icon: AlertTriangle,
      color:
        "bg-brand-yellow",
    },

    {
      label: "Herd Risk Index",
      value: loading
        ? "..."
        : formatPercentage(
            herdRiskIndex
          ),
      icon: Activity,
      color:
        "bg-brand-teal",
    },
  ];

  /* =======================================================
     HARDWARE
  ======================================================= */

  const hardwareOnline =
    hardware?.status === "online";

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        <div>
          <h1 className="text-2xl font-bold text-brand-navy">
            Command Center
          </h1>

          <p className="text-brand-text-secondary mt-1">
            Real-time herd health monitoring & predictions
          </p>
        </div>

        <div className="flex items-center gap-3">

          {/* REFRESH */}

          <button
            type="button"
            onClick={() =>
              loadDashboard(true)
            }
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-brand-navy hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />

            <span className="text-sm font-medium">
              Refresh
            </span>
          </button>

          {/* HARDWARE STATUS */}

          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              hardwareOnline
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >

            {hardwareOnline ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}

            <span>
              {hardwareOnline
                ? "ESP8266 Online"
                : "Hardware Offline"}
            </span>

          </div>

        </div>

      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center justify-between gap-4">

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              loadDashboard(true)
            }
            className="font-semibold underline"
          >
            Retry
          </button>

        </div>
      )}

      {/* =================================================
          KPI CARDS
      ================================================= */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {kpis.map(
          (kpi, index) => {
            const Icon =
              kpi.icon;

            return (
              <div
                key={index}
                className={`bg-white p-6 rounded-2xl shadow-sm border ${
                  kpi.pulse
                    ? "border-brand-red ring-1 ring-brand-red/20"
                    : "border-gray-100"
                }`}
              >

                <div className="flex items-start justify-between">

                  <div>

                    <p className="text-sm font-medium text-brand-text-secondary mb-1">
                      {kpi.label}
                    </p>

                    <h3 className="text-3xl font-bold text-brand-text-primary">
                      {kpi.value}
                    </h3>

                  </div>

                  <div
                    className={`p-3 rounded-xl text-white ${kpi.color} ${
                      kpi.pulse
                        ? "animate-pulse"
                        : ""
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                </div>

              </div>
            );
          }
        )}

      </div>

      {/* =================================================
          MAIN CHARTS
      ================================================= */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* =================================================
            HERD HEALTH TREND
        ================================================= */}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">

          <div className="flex items-center justify-between mb-4">

            <div>

              <h2 className="text-lg font-bold text-brand-navy">
                Herd Health Trend
              </h2>

              <p className="text-xs text-brand-text-secondary mt-1">
                Historical herd risk index
              </p>

            </div>

            <div className="flex items-center gap-2 text-xs text-brand-text-secondary">

              <span className="w-2 h-2 rounded-full bg-brand-red" />

              7-Day Risk

            </div>

          </div>

          <div className="h-[300px]">

            {loading ? (

              <div className="h-full flex items-center justify-center text-gray-400">
                Loading herd trend...
              </div>

            ) : herdRiskHistory.length === 0 ? (

              <div className="h-full flex flex-col items-center justify-center text-gray-400">

                <TrendingUp className="w-8 h-8 mb-2 opacity-40" />

                <span className="text-sm">
                  No risk history available yet.
                </span>

              </div>

            ) : (

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <AreaChart
                  data={
                    herdRiskHistory
                  }
                  margin={{
                    top: 10,
                    right: 10,
                    left: -20,
                    bottom: 0,
                  }}
                >

                  <defs>

                    <linearGradient
                      id="dashboardRiskGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >

                      <stop
                        offset="5%"
                        stopColor="var(--color-brand-red)"
                        stopOpacity={0.3}
                      />

                      <stop
                        offset="95%"
                        stopColor="var(--color-brand-red)"
                        stopOpacity={0}
                      />

                    </linearGradient>

                  </defs>

                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "#636E72",
                    }}
                    tickFormatter={(
                      value
                    ) =>
                      formatDate(
                        String(value)
                      )
                    }
                  />

                  <YAxis
                    domain={[
                      0,
                      1,
                    ]}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "#636E72",
                    }}
                    tickFormatter={(
                      value
                    ) =>
                      `${Math.round(
                        Number(value) *
                          100
                      )}%`
                    }
                  />

                  <Tooltip
                    contentStyle={{
                      borderRadius:
                        "12px",
                      border:
                        "none",
                      boxShadow:
                        "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(
                      value: unknown
                    ) => {
                      const numericValue =
                        Number(
                          value ?? 0
                        );

                      return [
                        `${Math.round(
                          numericValue *
                            100
                        )}%`,
                        "7-Day Risk",
                      ];
                    }}
                    labelFormatter={(
                      value: unknown
                    ) =>
                      formatDate(
                        String(value)
                      )
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="risk"
                    stroke="var(--color-brand-red)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#dashboardRiskGradient)"
                  />

                </AreaChart>

              </ResponsiveContainer>

            )}

          </div>

        </div>

        {/* =================================================
            RISK DISTRIBUTION
        ================================================= */}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">

          <h2 className="text-lg font-bold text-brand-navy mb-4">
            Risk Distribution
          </h2>

          <div className="flex-1 relative min-h-[220px]">

            {loading ? (

              <div className="h-full flex items-center justify-center text-gray-400">
                Loading...
              </div>

            ) : totalCows === 0 ? (

              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No animal data available.
              </div>

            ) : (

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <PieChart>

                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >

                    {pieData.map(
                      (
                        entry,
                        index
                      ) => (
                        <Cell
                          key={`risk-${index}`}
                          fill={
                            entry.color
                          }
                        />
                      )
                    )}

                  </Pie>

                  <Tooltip
                    contentStyle={{
                      borderRadius:
                        "8px",
                      border:
                        "none",
                      boxShadow:
                        "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />

                </PieChart>

              </ResponsiveContainer>

            )}

            {!loading &&
              totalCows > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">

                  <span className="text-3xl font-bold text-brand-navy">
                    {highRiskCount}
                  </span>

                  <span className="text-xs text-brand-text-secondary font-medium">
                    High Risk
                  </span>

                </div>
              )}

          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">

            {pieData.map(
              (item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-2 text-sm"
                >

                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        item.color,
                    }}
                  />

                  <span className="text-brand-text-secondary">

                    {item.name}

                    <strong className="text-brand-text-primary ml-1">
                      {item.value}
                    </strong>

                  </span>

                </div>
              )
            )}

          </div>

        </div>

      </div>

      {/* =================================================
          BOTTOM ROW
      ================================================= */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* =================================================
            RISK CLUSTERS
        ================================================= */}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">

          <div className="flex justify-between items-center mb-4">

            <div className="flex items-center gap-2">

              <MapPin className="w-5 h-5 text-brand-teal" />

              <h2 className="text-lg font-bold text-brand-navy">
                Risk Clusters
              </h2>

            </div>

            <Link
              to="/analytics"
              className="text-sm font-medium text-brand-teal hover:underline"
            >
              View Map →
            </Link>

          </div>

          <div className="space-y-3">

            {clusterList.length === 0 ? (

              <div className="py-8 text-center">

                <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />

                <p className="text-sm text-gray-400">
                  No risk clusters detected.
                </p>

              </div>

            ) : (

              clusterList
                .slice(0, 3)
                .map(
                  (
                    cluster,
                    index
                  ) => {

                    const risk =
                      cluster
                        .properties
                        .risk_level;

                    const isHigh =
                      risk ===
                      "HIGH";

                    const isModerate =
                      risk ===
                      "MODERATE";

                    const affectedCount =
                      Array.isArray(
                        cluster
                          .properties
                          .affected_cows
                      )
                        ? cluster
                            .properties
                            .affected_cows
                            .length
                        : 0;

                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-xl border flex justify-between items-center ${
                          isHigh
                            ? "border-red-100 bg-red-50"
                            : isModerate
                            ? "border-yellow-100 bg-yellow-50"
                            : "border-green-100 bg-green-50"
                        }`}
                      >

                        <div>

                          <h4 className="font-bold text-brand-navy">
                            {
                              cluster
                                .properties
                                .cluster_name
                            }
                          </h4>

                          <p className="text-sm text-brand-text-secondary mt-1">
                            {
                              affectedCount
                            }{" "}
                            affected animals
                          </p>

                        </div>

                        <span
                          className={`px-3 py-1 text-white text-xs font-bold rounded-full ${
                            isHigh
                              ? "bg-brand-red"
                              : isModerate
                              ? "bg-brand-yellow"
                              : "bg-brand-teal"
                          }`}
                        >
                          {risk}
                        </span>

                      </div>
                    );
                  }
                )

            )}

          </div>

        </div>

        {/* =================================================
            LIVE ALERTS
        ================================================= */}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">

          <div className="flex justify-between items-center mb-4">

            <div className="flex items-center gap-2">

              <Bell className="w-5 h-5 text-brand-red" />

              <h2 className="text-lg font-bold text-brand-navy">
                Live Alerts
              </h2>

              {activeAlerts.length >
                0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                  {
                    activeAlerts.length
                  }
                </span>
              )}

            </div>

            <Link
              to="/alerts"
              className="text-sm font-medium text-brand-teal hover:underline"
            >
              View All →
            </Link>

          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-2">

            {loading ? (

              <div className="py-10 text-center text-gray-400 text-sm">
                Loading alerts...
              </div>

            ) : displayedAlerts.length ===
              0 ? (

              <div className="flex flex-col items-center justify-center py-10 text-gray-400">

                <Bell className="w-8 h-8 mb-2 opacity-40" />

                <span className="text-sm">
                  No active alerts.
                </span>

              </div>

            ) : (

              displayedAlerts
                .slice(0, 10)
                .map(
                  (alert) => (

                    <div
                      key={alert.id}
                      className="flex gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors border-l-2 border-transparent hover:border-brand-teal"
                    >

                      <div className="mt-1">

                        {alert.severity ===
                        "HIGH" ? (

                          <div className="w-2 h-2 rounded-full bg-brand-red ring-4 ring-brand-red/20" />

                        ) : (

                          <div className="w-2 h-2 rounded-full bg-brand-yellow ring-4 ring-brand-yellow/20" />

                        )}

                      </div>

                      <div className="flex-1 min-w-0">

                        <div className="flex justify-between gap-3">

                          <Link
                            to={`/animal/${alert.animal_id}`}
                            className="font-bold text-brand-navy text-sm hover:underline"
                          >
                            {
                              alert.animal_id
                            }
                          </Link>

                          <span className="text-xs text-gray-400 whitespace-nowrap">

                            {formatDateTime(
                              alert.created_at
                            )}

                          </span>

                        </div>

                        <p className="text-sm text-brand-text-secondary mt-1">
                          {
                            alert.message
                          }
                        </p>

                        <div className="mt-2">

                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              alert.severity ===
                              "HIGH"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {
                              alert.severity
                            }
                          </span>

                        </div>

                      </div>

                    </div>

                  )
                )

            )}

          </div>

        </div>

      </div>

    </div>
  );
}