import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardPlus, LoaderCircle, Stethoscope } from 'lucide-react';
import { createMastitisEvent, fetchAnimals, fetchMastitisEvents } from '../lib/api';
import {
  Animal,
  DiagnosisMethod,
  MastitisEvent,
  MastitisEventInput,
  MastitisEventStatus,
} from '../types';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from 'react-i18next';

const diagnosisOptions: { value: DiagnosisMethod; label: string }[] = [
  { value: 'CLINICAL_EXAM', label: 'Clinical examination' },
  { value: 'CMT', label: 'California Mastitis Test (CMT)' },
  { value: 'SCC', label: 'Somatic cell count (SCC)' },
  { value: 'CULTURE', label: 'Milk culture' },
  { value: 'TREATMENT_RECORD', label: 'Treatment record' },
  { value: 'OTHER', label: 'Other evidence' },
];

const initialLocalTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

export default function ClinicalEvents() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canReport = hasPermission('events.report');
  const canConfirm = hasPermission('events.confirm');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [events, setEvents] = useState<MastitisEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [animalId, setAnimalId] = useState('');
  const [eventTime, setEventTime] = useState(initialLocalTime);
  const [status, setStatus] = useState<MastitisEventStatus>(() => canConfirm ? 'CONFIRMED' : 'SUSPECTED');
  const [diagnosisMethod, setDiagnosisMethod] = useState<DiagnosisMethod>('CLINICAL_EXAM');
  const [diagnosisResult, setDiagnosisResult] = useState('');
  const [confirmedBy, setConfirmedBy] = useState('');
  const [cmtResult, setCmtResult] = useState('');
  const [sccValue, setSccValue] = useState('');
  const [clinicalSigns, setClinicalSigns] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [animalRows, eventRows] = await Promise.all([
        fetchAnimals(),
        fetchMastitisEvents(),
      ]);
      setAnimals(animalRows);
      setEvents(eventRows);
      setAnimalId(current => current || animalRows[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load event data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const animalTags = useMemo(
    () => new Map(animals.map(animal => [animal.id, animal.tag_number])),
    [animals],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      if (!canReport) throw new Error('Your role has read-only access to clinical events.');
      if (!canConfirm && status !== 'SUSPECTED') throw new Error('Your role can report suspected events only.');
      const payload: MastitisEventInput = {
        animal_id: animalId,
        event_time: new Date(eventTime).toISOString(),
        status,
        diagnosis_method: diagnosisMethod,
        diagnosis_result: diagnosisResult || undefined,
        confirmed_by: confirmedBy || undefined,
        cmt_result: diagnosisMethod === 'CMT' ? cmtResult || undefined : undefined,
        scc_value: diagnosisMethod === 'SCC' ? Number(sccValue) : undefined,
        clinical_signs: clinicalSigns
          .split(',')
          .map(sign => sign.trim())
          .filter(Boolean),
        notes: notes || undefined,
      };
      const saved = await createMastitisEvent(payload);
      setEvents(current => [saved, ...current]);
      setSuccess('Clinical event saved and available for future model labels.');
      setDiagnosisResult('');
      setCmtResult('');
      setSccValue('');
      setClinicalSigns('');
      setNotes('');
      setEventTime(initialLocalTime());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">{t('clinicalEvents')}</h1>
        <p className="text-brand-text-secondary mt-1">
          Record the earliest clinical onset or confirmed detection time for genuine 7-to-14-day labels.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
        {canReport ? <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-teal/10 p-2 text-brand-teal">
              <ClipboardPlus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-brand-navy">New event record</h2>
              <p className="text-sm text-brand-text-secondary">Fields marked required protect label quality.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-brand-navy">
              Animal *
              <select required value={animalId} onChange={event => setAnimalId(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                {animals.map(animal => <option key={animal.id} value={animal.id}>{animal.tag_number}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium text-brand-navy">
              {t('firstClinicalOnset')} *
              <input required type="datetime-local" max={initialLocalTime()} value={eventTime} onChange={event => setEventTime(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-brand-navy">
              Status *
              <select value={status} onChange={event => setStatus(event.target.value as MastitisEventStatus)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <option value="SUSPECTED">Suspected</option>
                {canConfirm && <option value="CONFIRMED">Confirmed</option>}
                {canConfirm && <option value="DISMISSED">Dismissed</option>}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium text-brand-navy">
              {t('diagnosisMethod')} *
              <select value={diagnosisMethod} onChange={event => setDiagnosisMethod(event.target.value as DiagnosisMethod)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                {diagnosisOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <label className="block space-y-1.5 text-sm font-medium text-brand-navy">
            Diagnosis result {status === 'CONFIRMED' && '*'}
            <input required={status === 'CONFIRMED'} value={diagnosisResult} onChange={event => setDiagnosisResult(event.target.value)} placeholder="e.g. clinical mastitis in right rear quarter" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-brand-navy">
              Confirmed by {status === 'CONFIRMED' && '*'}
              <input required={status === 'CONFIRMED'} value={confirmedBy} onChange={event => setConfirmedBy(event.target.value)} placeholder="Veterinarian or operator" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
            </label>
            {diagnosisMethod === 'CMT' && (
              <label className="space-y-1.5 text-sm font-medium text-brand-navy">
                CMT result *
                <input required value={cmtResult} onChange={event => setCmtResult(event.target.value)} placeholder="Negative, trace, 1+, 2+, 3+" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
              </label>
            )}
            {diagnosisMethod === 'SCC' && (
              <label className="space-y-1.5 text-sm font-medium text-brand-navy">
                SCC value (cells/mL) *
                <input required min="0" max="100000000" type="number" value={sccValue} onChange={event => setSccValue(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
              </label>
            )}
          </div>

          <label className="block space-y-1.5 text-sm font-medium text-brand-navy">
            {t('clinicalSigns')}
            <input value={clinicalSigns} onChange={event => setClinicalSigns(event.target.value)} placeholder="Comma-separated: swelling, clots, fever" className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-brand-navy">
            Notes
            <textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5" />
          </label>

          <button disabled={saving || loading || !animalId} type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-teal px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-teal/90 disabled:cursor-not-allowed disabled:opacity-50">
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? `${t('loading')}...` : t('save')}
          </button>
        </form> : (
          <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
            <ClipboardPlus className="h-9 w-9 text-brand-teal/60" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-brand-navy">Clinical records are read-only</h2>
            <p className="mt-2 text-brand-text-secondary">Your role can review recorded events but cannot create or confirm them.</p>
          </section>
        )}

        <section aria-labelledby="recent-events-title" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 p-5">
            <h2 id="recent-events-title" className="font-bold text-brand-navy">{t('recentRecords')}</h2>
            <p className="text-sm text-brand-text-secondary">{events.length} event{events.length === 1 ? '' : 's'} loaded</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-brand-text-secondary">
              <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> {t('loading')}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center p-10 text-center text-brand-text-secondary">
              <Stethoscope className="mb-3 h-9 w-9 text-brand-teal/60" aria-hidden="true" />
              <p className="font-medium text-brand-navy">No clinical events yet</p>
              <p className="mt-1 text-sm">The first saved event will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {events.map(event => (
                <article key={event.id} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-brand-navy">{animalTags.get(event.animal_id) || event.animal_id}</p>
                    <span className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal">{event.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-brand-text-secondary">{event.diagnosis_method.replaceAll('_', ' ')} · {new Date(event.event_time).toLocaleString()}</p>
                  {event.diagnosis_result && <p className="mt-1 text-sm text-brand-navy">{event.diagnosis_result}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
