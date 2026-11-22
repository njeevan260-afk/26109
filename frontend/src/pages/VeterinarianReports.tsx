import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  HeartPulse,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  Users,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchAlerts, fetchAnimals, fetchPrediction } from '../lib/api';
import {
  fetchVeterinarianReports,
  subscribeToDoctorReports,
  updateDoctorReportStatus,
} from '../lib/doctorReports';
import {
  Alert,
  Animal,
  DoctorReport,
  DoctorReportStatus,
  Prediction,
  RiskCategory,
} from '../types';

interface HighRiskCow {
  animal: Animal;
  prediction: Prediction;
  alert?: Alert;
}

export default function VeterinarianReports() {
  const { identity } = useAuth();
  const [reports, setReports] = useState<DoctorReport[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [cowPredictions, setCowPredictions] = useState<Record<string, Prediction>>({});
  const [highRiskCows, setHighRiskCows] = useState<HighRiskCow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [reportsData, animalsData, alertsData] = await Promise.all([
          fetchVeterinarianReports(),
          fetchAnimals(),
          fetchAlerts(),
        ]);

        if (!active) return;
        setReports(reportsData);
        setAnimals(animalsData);

        // Fetch predictions for cows in reports and identify genuine high-risk cases
        const predictionsMap: Record<string, Prediction> = {};
        const highRiskList: HighRiskCow[] = [];

        await Promise.all(
          animalsData.map(async (animal) => {
            try {
              const pred = await fetchPrediction(animal.id);
              if (pred) {
                predictionsMap[animal.id] = pred;
                // Genuine high-risk definition: category === 'HIGH' (risk_7d > 0.70)
                if (pred.category === 'HIGH') {
                  const matchingAlert = alertsData.find(
                    (a) => a.animal_id === animal.id && a.status === 'UNRESOLVED',
                  );
                  highRiskList.push({
                    animal,
                    prediction: pred,
                    alert: matchingAlert,
                  });
                }
              }
            } catch {
              // Ignore individual prediction fetch errors
            }
          }),
        );

        if (!active) return;
        setCowPredictions(predictionsMap);
        setHighRiskCows(highRiskList);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load clinical data');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    const unsubscribe = subscribeToDoctorReports(() => {
      void fetchVeterinarianReports().then((updated) => {
        if (active) setReports(updated);
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (identity?.role !== 'VETERINARIAN') {
    return <Navigate to={identity?.dashboard_path || '/pending'} replace />;
  }

  const handleStatusChange = async (reportId: string, nextStatus: DoctorReportStatus) => {
    setUpdatingReportId(reportId);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateDoctorReportStatus(reportId, nextStatus);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSuccess(`Report status updated to "${nextStatus.replace('_', ' ')}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update report status');
    } finally {
      setUpdatingReportId(null);
    }
  };

  const getRiskBadge = (category?: RiskCategory) => {
    switch (category) {
      case 'HIGH':
        return (
          <span className="rounded-md bg-brand-red/10 px-2.5 py-1 text-xs font-bold text-brand-red">
            HIGH RISK
          </span>
        );
      case 'MODERATE':
        return (
          <span className="rounded-md bg-brand-yellow/10 px-2.5 py-1 text-xs font-bold text-brand-yellow">
            MODERATE RISK
          </span>
        );
      case 'LOW':
        return (
          <span className="rounded-md bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal">
            LOW RISK
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500">
            NO RISK
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
            Submitted
          </span>
        );
      case 'pending_review':
        return (
          <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
            Pending Review
          </span>
        );
      case 'under_investigation':
        return (
          <span className="rounded-md bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700">
            Under Investigation
          </span>
        );
      case 'resolved':
        return (
          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
            Resolved
          </span>
        );
      case 'closed':
        return (
          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
            Closed
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500">
            {status}
          </span>
        );
    }
  };

  const pendingReportsCount = reports.filter(
    (r) => r.status === 'submitted' || r.status === 'pending_review',
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header Banner */}
      <section className="rounded-3xl bg-gradient-to-br from-brand-navy via-slate-800 to-brand-teal p-7 text-white shadow-lg">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-300">
              <Stethoscope className="h-5 w-5" aria-hidden="true" />
              <span>Veterinary Clinical Desk</span>
            </div>
            <h1 className="text-3xl font-bold">
              Welcome, {identity?.display_name || 'Doctor'}
            </h1>
            <p className="mt-1 max-w-2xl text-slate-200">
              Review consultation reports assigned to you, inspect genuine high-risk mastitis
              cases, and access herd vitals telemetry.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wider text-slate-300">Authorized Status</p>
            <p className="mt-1 flex items-center gap-2 font-bold text-emerald-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              Verified & Active
            </p>
          </div>
        </div>
      </section>

      {/* Metric Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-700">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-brand-navy">{reports.length}</p>
          <p className="mt-1 text-sm text-brand-text-secondary">Assigned Reports</p>
        </article>

        <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-xl bg-amber-50 p-2.5 text-amber-700">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-brand-navy">{pendingReportsCount}</p>
          <p className="mt-1 text-sm text-brand-text-secondary">Pending Action</p>
        </article>

        <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-xl bg-red-50 p-2.5 text-brand-red">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-3xl font-bold text-brand-navy">{highRiskCows.length}</p>
          <p className="mt-1 text-sm text-brand-text-secondary">Active High-Risk Cases</p>
        </article>

        <Link
          to="/herd"
          className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-brand-teal/30 hover:shadow-md"
        >
          <div className="mb-3 inline-flex rounded-xl bg-brand-teal/10 p-2.5 text-brand-teal">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-brand-navy group-hover:text-brand-teal">
              Herd Management
            </p>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-brand-teal" />
          </div>
          <p className="mt-1 text-xs text-brand-text-secondary">View all herd cows & vitals</p>
        </Link>
      </section>

      {/* Feedback Banners */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{success}</span>
        </div>
      )}

      {/* Assigned Reports Table */}
      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div>
            <h2 className="text-xl font-bold text-brand-navy">Assigned Consultation Reports</h2>
            <p className="text-xs text-brand-text-secondary">
              Clinical reports submitted by farmers assigned directly to your account.
            </p>
          </div>
          <span className="rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
            {reports.length} report(s)
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-brand-text-secondary">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-300" />
            <p className="mt-2">Loading assigned reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-sm text-brand-text-secondary">
            No consultation reports have been assigned to your clinical desk yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((report) => {
              const animal = animals.find((a) => a.id === report.cow_id);
              const pred = cowPredictions[report.cow_id];

              return (
                <article key={report.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="space-y-3 flex-1">
                      {/* Top row: Cow tag, risk badge, status badge, timestamps */}
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          to={`/animal/${report.cow_id}`}
                          className="font-bold text-base text-brand-navy hover:text-brand-teal hover:underline flex items-center gap-1.5"
                        >
                          <span>Cow {animal ? animal.tag_number : report.cow_id.slice(0, 8)}</span>
                          <Eye className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </Link>
                        {animal && (
                          <span className="text-xs text-brand-text-secondary">
                            ({animal.breed}, Lactation #{animal.lactation_number})
                          </span>
                        )}
                        {pred && getRiskBadge(pred.category)}
                        {getStatusBadge(report.status)}
                      </div>

                      {/* Farmer and cow telemetry summary */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-brand-text-secondary">
                        <p>
                          <span className="font-semibold text-gray-600">Farmer Ref:</span>{' '}
                          <span className="font-mono text-gray-700">
                            {report.farmer_id.slice(0, 8)}...
                          </span>
                        </p>
                        <p>
                          <span className="font-semibold text-gray-600">Submitted:</span>{' '}
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                        {report.updated_at !== report.created_at && (
                          <p>
                            <span className="font-semibold text-gray-600">Updated:</span>{' '}
                            {new Date(report.updated_at).toLocaleString()}
                          </p>
                        )}
                        {pred && (
                          <p>
                            <span className="font-semibold text-gray-600">7-Day Risk Signal:</span>{' '}
                            <strong className="text-brand-navy">
                              {Math.round(pred.risk_7day * 100)}%
                            </strong>
                          </p>
                        )}
                        {animal && (
                          <p>
                            <span className="font-semibold text-gray-600">Baseline EC:</span>{' '}
                            {animal.baseline_ec} mS/cm |{' '}
                            <span className="font-semibold text-gray-600">Temp:</span>{' '}
                            {animal.baseline_temp}°C
                          </p>
                        )}
                      </div>

                      {/* Symptom description */}
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                          Farmer Symptom Description
                        </p>
                        <p className="text-sm text-brand-navy whitespace-pre-wrap">
                          {report.description}
                        </p>
                      </div>
                    </div>

                    {/* Right: Status Action Control */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <label className="text-xs font-semibold text-brand-navy">
                        Update Report Status:
                      </label>
                      <select
                        disabled={updatingReportId === report.id}
                        value={report.status}
                        onChange={(e) =>
                          void handleStatusChange(
                            report.id,
                            e.target.value as DoctorReportStatus,
                          )
                        }
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-navy outline-none focus:ring-2 focus:ring-brand-teal/50 disabled:opacity-50"
                      >
                        <option value="submitted">Submitted</option>
                        <option value="pending_review">Pending Review</option>
                        <option value="under_investigation">Under Investigation</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <Link
                        to={`/animal/${report.cow_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-teal hover:underline mt-1"
                      >
                        <span>Open animal chart</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Genuine High-Risk Herd Cases Section */}
      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-brand-red" aria-hidden="true" />
            <h2 className="text-xl font-bold text-brand-navy">Genuine High-Risk Cases</h2>
          </div>
          <p className="text-xs text-brand-text-secondary mt-1">
            Animals meeting the application’s current acute threshold (7-day risk &gt; 70% or elevated high-risk alert).
          </p>
        </div>

        {highRiskCows.length === 0 ? (
          <div className="p-8 text-center text-sm text-brand-text-secondary">
            No cows currently meet the acute high-risk criteria.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {highRiskCows.map(({ animal, prediction, alert }) => (
              <div
                key={animal.id}
                className="flex flex-col justify-between gap-4 p-5 hover:bg-gray-50/50 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand-navy">{animal.tag_number}</span>
                    <span className="text-xs text-brand-text-secondary">
                      ({animal.breed}, Lactation #{animal.lactation_number})
                    </span>
                    {getRiskBadge(prediction.category)}
                  </div>
                  {alert && (
                    <p className="text-xs text-brand-red font-medium">{alert.message}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-brand-text-secondary">
                    <span>
                      Risk Signal:{' '}
                      <strong className="text-brand-navy">
                        {Math.round(prediction.risk_7day * 100)}%
                      </strong>
                    </span>
                    <span>
                      Latest EC:{' '}
                      <strong className="text-brand-navy">
                        {prediction.latest_ec?.toFixed(2) || animal.baseline_ec} mS/cm
                      </strong>
                    </span>
                    <span>
                      Latest Temp:{' '}
                      <strong className="text-brand-navy">
                        {prediction.latest_temp?.toFixed(1) || animal.baseline_temp}°C
                      </strong>
                    </span>
                  </div>
                </div>

                <Link
                  to={`/animal/${animal.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-teal/40 bg-brand-teal/5 px-3 py-1.5 text-xs font-bold text-brand-navy hover:bg-brand-teal/10 shrink-0"
                >
                  <span>Examine Vitals</span>
                  <ArrowRight className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
