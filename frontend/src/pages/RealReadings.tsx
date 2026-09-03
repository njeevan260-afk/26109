import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Clock3,
  Radio,
  RefreshCw,
  Thermometer,
  Waves,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { fetchRealSensorReadings } from '../lib/api';
import { SensorReading } from '../types';
import { useTranslation } from 'react-i18next';

const POLL_INTERVAL_MS = 5_000;
const ONLINE_WINDOW_MS = 20_000;
type ReadingRiskCategory = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';

interface LatestAnimalReadings {
  key: string;
  animalId: string | null;
  tagNumber: string;
  breed: string | null;
  deviceId: string;
  latestAt: string;
  ec?: SensorReading;
  temp?: SensorReading;
}

function formatReadingTime(value: string, locale: string, unknownLabel: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return unknownLabel;
  return date.toLocaleString(locale);
}

function isOnline(readingTime: string) {
  const timestamp = new Date(readingTime).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= ONLINE_WINDOW_MS;
}

function readingRiskLevel(reading: SensorReading): ReadingRiskCategory {
  const backendRisk = (
    reading as SensorReading & { risk_level?: ReadingRiskCategory }
  ).risk_level;
  if (backendRisk) return backendRisk;

  if (reading.sensor_type === 'EC') {
    if (reading.value > 6) return 'HIGH';
    if (reading.value > 5) return 'MODERATE';
    if (reading.value > 4.5) return 'LOW';
  } else {
    if (reading.value > 39.5) return 'HIGH';
    if (reading.value > 39) return 'MODERATE';
    if (reading.value > 38.5) return 'LOW';
  }

  return 'NONE';
}

export default function RealReadings() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReadings = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    try {
      const data = await fetchRealSensorReadings();
      setReadings(data.filter(reading => reading.is_simulated === false));
      setError(null);
    } catch (requestError) {
      console.error(requestError);
      setError(t('realPage.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void loadReadings();
    const intervalId = window.setInterval(() => void loadReadings(true), POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadReadings]);

  const latestByAnimal = useMemo(() => {
    const grouped = new Map<string, LatestAnimalReadings>();

    for (const reading of readings) {
      const key = reading.animal_id || reading.device_id || reading.id;
      const current = grouped.get(key) ?? {
        key,
        animalId: reading.animal_id || null,
        tagNumber: reading.tag_number || t('realPage.unassignedAnimal'),
        breed: reading.breed || null,
        deviceId: reading.device_id || t('realPage.unknownDevice'),
        latestAt: reading.reading_time,
      };

      if (new Date(reading.reading_time) > new Date(current.latestAt)) {
        current.latestAt = reading.reading_time;
        current.deviceId = reading.device_id || current.deviceId;
      }
      if (reading.sensor_type === 'EC' && !current.ec) current.ec = reading;
      if (reading.sensor_type === 'TEMP' && !current.temp) current.temp = reading;
      grouped.set(key, current);
    }

    return [...grouped.values()].sort(
      (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
    );
  }, [readings, t]);

  const devices = useMemo(
    () => new Set(readings.map(reading => reading.device_id).filter(Boolean)),
    [readings],
  );
  const animalsReporting = useMemo(
    () => new Set(readings.map(reading => reading.animal_id).filter(Boolean)).size,
    [readings],
  );
  const latestReading = readings[0]?.reading_time ?? null;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-teal">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-teal" />
            {t('realPage.feed')}
          </div>
          <h1 className="text-2xl font-bold text-brand-navy md:text-3xl">{t('realPage.title')}</h1>
          <p className="mt-1 text-sm text-brand-text-secondary">
            {t('realPage.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReadings(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t('common.refreshNow')}
        </button>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}. {t('realPage.staleData')}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Activity} label={t('realPage.readingsLoaded')} value={readings.length.toLocaleString(locale)} />
        <SummaryCard icon={Radio} label={t('realPage.devices')} value={devices.size.toLocaleString(locale)} />
        <SummaryCard icon={Waves} label={t('realPage.animalsReporting')} value={animalsReporting.toLocaleString(locale)} />
        <SummaryCard
          icon={Clock3}
          label={t('realPage.latestReading')}
          value={latestReading ? formatReadingTime(latestReading, locale, t('realPage.unknownTime')) : t('realPage.waitingData')}
          compact
        />
      </section>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <RefreshCw className="h-7 w-7 animate-spin text-brand-teal" aria-label={t('realPage.loadingReadings')} />
        </div>
      ) : readings.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-brand-teal/40 bg-white px-6 py-14 text-center">
          <Radio className="mx-auto h-12 w-12 text-brand-teal" />
          <h2 className="mt-4 text-xl font-bold text-brand-navy">{t('realPage.waitingFirst')}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-brand-text-secondary">
            {t('realPage.sendPayloadBefore')} <code className="rounded bg-gray-100 px-1.5 py-0.5">POST /api/readings</code>{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5">is_simulated: false</code>. {t('realPage.sendPayloadAfter')}
          </p>
        </section>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-bold text-brand-navy">{t('realPage.latestByAnimal')}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {latestByAnimal.map(item => {
                const online = isOnline(item.latestAt);
                return (
                  <article key={item.key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-brand-navy">{item.tagNumber}</h3>
                        <p className="text-xs text-brand-text-secondary">
                          {[item.breed, item.deviceId].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        {online ? t('common.online') : t('common.offline')}
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <ReadingValue icon={Waves} label="EC" reading={item.ec} />
                      <ReadingValue icon={Thermometer} label={t('common.temperature')} reading={item.temp} />
                    </div>
                    <p className="mt-4 text-xs text-brand-text-secondary">{t('realPage.lastSeen', { time: formatReadingTime(item.latestAt, locale, t('realPage.unknownTime')) })}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-bold text-brand-navy">{t('realPage.recentReadings')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t('realPage.caption')}</caption>
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-brand-text-secondary">
                  <tr>
                    <th className="px-5 py-3">{t('common.time')}</th>
                    <th className="px-5 py-3">{t('common.animal')}</th>
                    <th className="px-5 py-3">{t('common.device')}</th>
                    <th className="px-5 py-3">{t('common.sensor')}</th>
                    <th className="px-5 py-3">{t('common.value')}</th>
                    <th className="px-5 py-3">{t('realPage.risk', { defaultValue: 'Risk' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {readings.slice(0, 100).map(reading => (
                    <tr key={reading.id} className="hover:bg-gray-50/70">
                      <td className="whitespace-nowrap px-5 py-3 text-brand-text-secondary">{formatReadingTime(reading.reading_time, locale, t('realPage.unknownTime'))}</td>
                      <td className="px-5 py-3 font-semibold text-brand-navy">{reading.tag_number || t('common.unassigned')}</td>
                      <td className="px-5 py-3">{reading.device_id || t('common.unknown')}</td>
                      <td className="px-5 py-3">{reading.sensor_type}</td>
                      <td className="whitespace-nowrap px-5 py-3 font-bold text-brand-navy">{reading.value.toFixed(2)} {reading.unit}</td>
                      <td className="px-5 py-3">
                        <RiskBadge risk={readingRiskLevel(reading)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  compact = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-brand-text-secondary">
        <Icon className="h-4 w-4 text-brand-teal" />
        {label}
      </div>
      <p className={`mt-3 font-bold text-brand-navy ${compact ? 'text-base' : 'text-2xl'}`}>{value}</p>
    </article>
  );
}

function RiskBadge({ risk }: { risk: ReadingRiskCategory }) {
  const { t } = useTranslation();
  const styles: Record<ReadingRiskCategory, string> = {
    NONE: 'bg-gray-100 text-gray-700',
    LOW: 'bg-emerald-50 text-emerald-700',
    MODERATE: 'bg-amber-50 text-amber-700',
    HIGH: 'bg-red-50 text-red-700',
  };
  const label = risk === 'NONE'
    ? t('realPage.noRisk', { defaultValue: 'No risk' })
    : t(`common.${risk.toLowerCase()}`);

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[risk]}`}>
      {label}
    </span>
  );
}

function ReadingValue({
  icon: Icon,
  label,
  reading,
}: {
  icon: typeof Activity;
  label: string;
  reading?: SensorReading;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
        <Icon className="h-3.5 w-3.5 text-brand-teal" />
        {label}
      </div>
      <p className="mt-1 text-lg font-bold text-brand-navy">
        {reading ? `${reading.value.toFixed(2)} ${reading.unit}` : '—'}
      </p>
    </div>
  );
}
