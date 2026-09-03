import { useEffect, useState } from 'react';
import { fetchAlerts, resolveAlert } from '../lib/api';
import { Alert } from '../types';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, HeartPulse, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { translateAlertMessage } from '../i18n/dynamicText';

function formatRelativeTime(value: string, locale: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.34524, 'week'], [12, 'month'], [Number.POSITIVE_INFINITY, 'year'],
  ];
  let duration = seconds;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(duration), unit);
    }
    duration /= amount;
  }
  return value;
}

const ALERT_GUIDANCE = {
  HIGH: {
    precautions: ['animalPage.recSeparate', 'animalPage.recHygieneCalibration'],
    care: ['animalPage.recInspect', 'animalPage.recVet'],
  },
  MODERATE: {
    precautions: ['animalPage.recHousing', 'animalPage.recMonitor'],
    care: ['animalPage.recExam', 'animalPage.recCmt'],
  },
} as const;

export default function AlertsCenter() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MODERATE' | 'RESOLVED' | 'UNRESOLVED'>('ALL');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refreshAlerts = () => {
      fetchAlerts()
        .then(data => {
          if (active) {
            setAlerts(data);
            setError(null);
          }
        })
        .catch(err => {
          console.error(err);
          if (active) setError(t('alertsPage.loadError'));
        });
    };

    refreshAlerts();
    const intervalId = window.setInterval(refreshAlerts, 5_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [t]);

  const handleResolve = async (alertId: string) => {
    setResolvingId(alertId);
    setError(null);
    try {
      const updated = await resolveAlert(alertId);
      setAlerts(current => current.map(alert => alert.id === alertId ? { ...alert, ...updated } : alert));
    } catch (err) {
      console.error(err);
      setError(t('alertsPage.resolveError'));
    } finally {
      setResolvingId(null);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'ALL') return true;
    if (filter === 'RESOLVED') return alert.status === 'RESOLVED';
    if (filter === 'UNRESOLVED') return alert.status === 'UNRESOLVED';
    return alert.severity === filter;
  });

  const getAlertIcon = (severity: string) => {
    if (severity === 'HIGH') return <ShieldAlert className="w-5 h-5 text-brand-red" />;
    return <AlertTriangle className="w-5 h-5 text-brand-yellow" />;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">{t('alertsCenter')}</h1>
          <p className="text-brand-text-secondary mt-1">{t('alertsPage.subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['ALL', 'HIGH', 'MODERATE', 'UNRESOLVED', 'RESOLVED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={clsx(
              "px-4 py-2 rounded-full text-sm font-semibold transition-colors",
              filter === f 
                ? "bg-brand-navy text-white shadow-sm" 
                : "bg-white text-brand-text-secondary border border-gray-200 hover:bg-gray-50"
            )}
          >
            {f === 'ALL' ? t('alertsPage.allAlerts') : t(`common.${f.toLowerCase()}`)}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
        {filteredAlerts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-gray-500">
            <CheckCircle className="w-12 h-12 text-brand-teal/50 mb-4" />
            <p className="text-lg font-medium text-brand-navy">{t('alertsPage.noAlerts')}</p>
            <p className="mt-1">{t('alertsPage.filterClear')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAlerts.map(alert => (
              <div key={alert.id} className={clsx(
                "p-5 flex flex-col gap-4 transition-colors hover:bg-gray-50",
                alert.status === 'RESOLVED' && "opacity-60 grayscale-[50%]"
              )}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4 items-start">
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    alert.severity === 'HIGH' ? 'bg-red-50 border border-red-100' : 'bg-yellow-50 border border-yellow-100'
                  )}>
                    {getAlertIcon(alert.severity)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/animal/${alert.animal_id}`} className="font-bold text-brand-navy hover:underline text-lg">
                        {alert.tag_number || alert.animal_id} ({alert.breed || t('noData')})
                      </Link>
                      {alert.status === 'RESOLVED' && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-bold rounded-md">{t('common.resolved')}</span>
                      )}
                    </div>
                    <p className="text-brand-text-secondary text-sm">{translateAlertMessage(t, alert.message)}</p>
                  </div>
                </div>
                
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 pl-14 sm:pl-0">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {formatRelativeTime(alert.created_at, locale)}
                  </div>
                  
                  <div className="flex gap-2">
                    {alert.status === 'UNRESOLVED' && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        disabled={resolvingId === alert.id}
                        className="px-3 py-1.5 bg-white border border-gray-200 text-brand-text-secondary text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {resolvingId === alert.id ? `${t('common.loading')}...` : t('alertsPage.markResolved')}
                      </button>
                    )}
                    <Link to={`/animal/${alert.animal_id}`} className="px-3 py-1.5 bg-brand-navy text-white text-xs font-bold rounded-lg hover:bg-brand-navy/90 transition-colors shadow-sm">
                      {t('common.viewAnimal')}
                    </Link>
                  </div>
                </div>
                </div>

                <div className="grid gap-3 pl-0 sm:grid-cols-2 sm:pl-14">
                  <GuidancePanel
                    icon={ShieldCheck}
                    title={t('alertsPage.precautions')}
                    items={ALERT_GUIDANCE[alert.severity].precautions.map(key => t(key))}
                    tone={alert.severity === 'HIGH' ? 'red' : 'amber'}
                  />
                  <GuidancePanel
                    icon={HeartPulse}
                    title={t('alertsPage.careRequired')}
                    items={ALERT_GUIDANCE[alert.severity].care.map(key => t(key))}
                    tone={alert.severity === 'HIGH' ? 'red' : 'amber'}
                  />
                </div>
                <p className="pl-0 text-xs text-brand-text-secondary sm:pl-14">
                  {t('alertsPage.clinicalDisclaimer')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function GuidancePanel({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof ShieldCheck;
  title: string;
  items: string[];
  tone: 'red' | 'amber';
}) {
  return (
    <section className={clsx(
      'rounded-xl border p-3',
      tone === 'red' ? 'border-red-100 bg-red-50/70' : 'border-amber-100 bg-amber-50/70',
    )}>
      <h3 className="flex items-center gap-2 text-sm font-bold text-brand-navy">
        <Icon className={clsx('h-4 w-4', tone === 'red' ? 'text-brand-red' : 'text-amber-600')} />
        {title}
      </h3>
      <ul className="mt-2 space-y-1 text-sm text-brand-text-secondary">
        {items.map(item => <li key={item}>• {item}</li>)}
      </ul>
    </section>
  );
}
