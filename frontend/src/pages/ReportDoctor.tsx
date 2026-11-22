import { FormEvent, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react';
import { fetchAnimals, fetchPrediction, fetchSensorReadings } from '../lib/api';
import {
  createDoctorReport,
  fetchActiveVeterinarians,
  fetchFarmerReports,
  subscribeToDoctorReports,
} from '../lib/doctorReports';
import {
  ActiveVeterinarian,
  Animal,
  DoctorReport,
  Prediction,
  RiskCategory,
  SensorReading,
} from '../types';

export default function ReportDoctor() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selectedCowId, setSelectedCowId] = useState<string>('');
  const [cowPrediction, setCowPrediction] = useState<Prediction | null>(null);
  const [recentReadings, setRecentReadings] = useState<SensorReading[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);

  const [veterinarians, setVeterinarians] = useState<ActiveVeterinarian[]>([]);
  const [selectedVetId, setSelectedVetId] = useState<string>('');

  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [reports, setReports] = useState<DoctorReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  // Load initial animals, active veterinarians and farmer reports
  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const [animalsData, vetsData, reportsData] = await Promise.all([
          fetchAnimals(),
          fetchActiveVeterinarians(),
          fetchFarmerReports(),
        ]);

        if (!active) return;

        setAnimals(animalsData);
        if (animalsData.length > 0) {
          setSelectedCowId(animalsData[0].id);
        }

        setVeterinarians(vetsData);
        if (vetsData.length > 0) {
          setSelectedVetId(vetsData[0].id);
        }

        setReports(reportsData);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load data');
        }
      } finally {
        if (active) setLoadingReports(false);
      }
    }

    void loadInitialData();

    // Subscribe to realtime updates on reports
    const unsubscribe = subscribeToDoctorReports(() => {
      void fetchFarmerReports().then((updated) => {
        if (active) setReports(updated);
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // When selected cow changes, load its genuine health and telemetry context
  useEffect(() => {
    if (!selectedCowId) {
      setCowPrediction(null);
      setRecentReadings([]);
      return;
    }

    let active = true;
    setLoadingContext(true);

    async function loadCowContext() {
      try {
        const [pred, readings] = await Promise.all([
          fetchPrediction(selectedCowId),
          fetchSensorReadings(selectedCowId),
        ]);
        if (!active) return;
        setCowPrediction(pred ?? null);
        setRecentReadings(readings ?? []);
      } catch {
        if (!active) return;
        setCowPrediction(null);
        setRecentReadings([]);
      } finally {
        if (active) setLoadingContext(false);
      }
    }

    void loadCowContext();

    return () => {
      active = false;
    };
  }, [selectedCowId]);

  const selectedAnimal = animals.find((a) => a.id === selectedCowId);
  const selectedVet = veterinarians.find((v) => v.id === selectedVetId);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCowId || !selectedVetId || !description.trim()) {
      setError('Please select an animal, a veterinarian, and provide a symptom description.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const savedReport = await createDoctorReport({
        cow_id: selectedCowId,
        veterinarian_id: selectedVetId,
        description: description.trim(),
      });

      setReports((prev) => [savedReport, ...prev]);
      setSuccess('Report submitted successfully to the veterinarian.');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-brand-teal">
          <Stethoscope className="h-4 w-4" aria-hidden="true" />
          <span>Veterinary Consultation</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-brand-navy">Report to a Doctor</h1>
        <p className="mt-1 text-brand-text-secondary">
          Request clinical examination from an active verified veterinarian for an affected cow.
        </p>
      </div>

      {/* Feedback Messages */}
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

      {/* Form & Context Grid */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        {/* Left: Consultation Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-teal/10 p-2.5 text-brand-teal">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-brand-navy">New Doctor Consultation Report</h2>
              <p className="text-xs text-brand-text-secondary">
                Select an affected animal and an active veterinarian to dispatch your report.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Animal Selection */}
            <label className="block space-y-1.5 text-sm font-medium text-brand-navy">
              <span>Select affected cow *</span>
              <select
                required
                value={selectedCowId}
                onChange={(e) => setSelectedCowId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-brand-navy outline-none focus:ring-2 focus:ring-brand-teal/50"
              >
                {animals.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.tag_number} ({animal.breed}, Lactation #{animal.lactation_number})
                  </option>
                ))}
              </select>
            </label>

            {/* Veterinarian Selection */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-brand-navy">
                <span>Select verified veterinarian *</span>
              </label>

              {veterinarians.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
                  <UserCheck className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-brand-navy">
                    No active verified veterinarians available
                  </p>
                  <p className="mt-1 text-xs text-brand-text-secondary">
                    Veterinarians must be approved by an administrator before appearing in the
                    consultation directory.
                  </p>
                </div>
              ) : (
                <>
                  <select
                    required
                    value={selectedVetId}
                    onChange={(e) => setSelectedVetId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-brand-navy outline-none focus:ring-2 focus:ring-brand-teal/50"
                  >
                    {veterinarians.map((vet) => (
                      <option key={vet.id} value={vet.id}>
                        {vet.display_name || 'Veterinarian'}
                        {vet.organization_name ? ` — ${vet.organization_name}` : ''}
                        {vet.locality ? ` (${vet.locality})` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Selected Veterinarian Details Preview */}
                  {selectedVet && (
                    <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 p-3.5 text-xs text-brand-text-secondary">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-brand-navy">
                          {selectedVet.display_name || 'Verified Veterinarian'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified
                        </span>
                      </div>
                      {selectedVet.organization_name && (
                        <p className="mt-1">
                          <span className="font-medium text-gray-600">Hospital/Affiliation:</span>{' '}
                          {selectedVet.organization_name}
                        </p>
                      )}
                      {selectedVet.locality && (
                        <p className="mt-0.5">
                          <span className="font-medium text-gray-600">Locality:</span>{' '}
                          {selectedVet.locality}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Symptom Description */}
            <label className="block space-y-1.5 text-sm font-medium text-brand-navy">
              <span>Observed symptoms and clinical notes *</span>
              <textarea
                required
                rows={4}
                minLength={5}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe specific symptoms observed (e.g., swollen quarter, milk clot or discoloration, heat in udder, reduced feed intake)..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-teal/50"
              />
              <span className="block text-right text-xs text-gray-400">
                {description.length} / 2000 characters
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="text-xs text-brand-text-secondary">
              Report status will be marked as <strong className="text-brand-navy">submitted</strong>.
            </p>
            <button
              type="submit"
              disabled={submitting || veterinarians.length === 0 || !selectedCowId}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-teal px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-teal/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Stethoscope className="h-4 w-4" aria-hidden="true" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right: Selected Cow Existing Health Context */}
        <aside className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-teal" aria-hidden="true" />
              <h2 className="font-bold text-brand-navy">Animal Health Context</h2>
            </div>
            {selectedAnimal && (
              <span className="font-mono text-sm font-bold text-brand-navy">
                {selectedAnimal.tag_number}
              </span>
            )}
          </div>

          {loadingContext ? (
            <div className="space-y-3 py-4 text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-300" />
              <p className="text-xs text-brand-text-secondary">Loading telemetry context...</p>
            </div>
          ) : selectedAnimal ? (
            <div className="space-y-4 text-sm">
              {/* Prediction Signal */}
              {cowPrediction ? (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-text-secondary">
                      Current Risk Signal
                    </span>
                    {getRiskBadge(cowPrediction.category)}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-brand-text-secondary">7-Day Mastitis Risk</span>
                    <span className="text-lg font-bold text-brand-navy">
                      {Math.round(cowPrediction.risk_7day * 100)}%
                    </span>
                  </div>
                  {cowPrediction.recommendations && cowPrediction.recommendations.length > 0 && (
                    <div className="border-t border-gray-200/60 pt-2 text-xs text-brand-text-secondary">
                      <p className="font-semibold text-brand-navy">System Guidance:</p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {cowPrediction.recommendations.slice(0, 2).map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center text-xs text-brand-text-secondary">
                  No prediction calculated for this animal yet.
                </div>
              )}

              {/* Baseline vs Latest Readings */}
              <div className="rounded-xl border border-gray-100 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-navy">
                  Vitals & Sensor Readings
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="block text-gray-400">Baseline EC</span>
                    <span className="font-mono font-bold text-brand-navy">
                      {selectedAnimal.baseline_ec} mS/cm
                    </span>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="block text-gray-400">Latest EC</span>
                    <span className="font-mono font-bold text-brand-navy">
                      {cowPrediction?.latest_ec
                        ? `${cowPrediction.latest_ec.toFixed(2)} mS/cm`
                        : `${selectedAnimal.baseline_ec} mS/cm`}
                    </span>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="block text-gray-400">Baseline Temp</span>
                    <span className="font-mono font-bold text-brand-navy">
                      {selectedAnimal.baseline_temp}°C
                    </span>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="block text-gray-400">Latest Temp</span>
                    <span className="font-mono font-bold text-brand-navy">
                      {cowPrediction?.latest_temp
                        ? `${cowPrediction.latest_temp.toFixed(1)}°C`
                        : `${selectedAnimal.baseline_temp}°C`}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-2 text-xs text-brand-text-secondary space-y-1">
                  <p>
                    <span className="font-medium">Breed:</span> {selectedAnimal.breed}
                  </p>
                  <p>
                    <span className="font-medium">Prior Mastitis Count:</span>{' '}
                    {selectedAnimal.previous_mastitis_count}
                  </p>
                  {recentReadings.length > 0 && (
                    <p>
                      <span className="font-medium">Telemetry samples:</span>{' '}
                      {recentReadings.length} reading(s) on file
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Select an animal to display health context.</p>
          )}
        </aside>
      </div>

      {/* Submitted Reports Section */}
      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand-navy" aria-hidden="true" />
            <h2 className="text-lg font-bold text-brand-navy">My Submitted Reports</h2>
          </div>
          <span className="rounded-full bg-brand-navy/5 px-2.5 py-0.5 text-xs font-bold text-brand-navy">
            {reports.length} report(s)
          </span>
        </div>

        {loadingReports ? (
          <div className="p-8 text-center text-sm text-brand-text-secondary">
            Loading your reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-sm text-brand-text-secondary">
            You have not submitted any doctor consultation reports yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((report) => {
              const animal = animals.find((a) => a.id === report.cow_id);
              const vet = veterinarians.find((v) => v.id === report.veterinarian_id);

              return (
                <article key={report.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-brand-navy">
                          Cow {animal ? animal.tag_number : report.cow_id.slice(0, 8)}
                        </span>
                        {getStatusBadge(report.status)}
                      </div>
                      <p className="mt-1 text-xs text-brand-text-secondary">
                        Assigned to:{' '}
                        <strong className="text-brand-navy">
                          {vet ? vet.display_name : 'Veterinarian'}
                        </strong>
                        {vet?.organization_name && ` (${vet.organization_name})`}
                      </p>
                    </div>
                    <time className="text-xs text-gray-400">
                      {new Date(report.created_at).toLocaleString()}
                    </time>
                  </div>

                  <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-brand-navy">
                    {report.description}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
