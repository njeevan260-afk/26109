import { useEffect, useState } from 'react';
import { fetchAnimals, fetchPrediction } from '../lib/api';
import { Animal, Prediction } from '../types';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type AnimalWithPred = Animal & { prediction?: Prediction };

export default function HerdManagement() {
  const { t } = useTranslation();
  const [animals, setAnimals] = useState<AnimalWithPred[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      const ani = await fetchAnimals();
      const withPreds = await Promise.all(ani.map(async (a) => {
        try {
          const pred = await fetchPrediction(a.id);
          return { ...a, prediction: pred };
        } catch {
          return a;
        }
      }));
      setAnimals(withPreds);
      setLoading(false);
    };
    loadData();
  }, []);

  const getRiskBadge = (category?: string) => {
    switch (category) {
      case 'HIGH': return <span className="px-2.5 py-1 bg-brand-red/10 text-brand-red text-xs font-bold rounded-md">{t('common.high')}</span>;
      case 'MODERATE': return <span className="px-2.5 py-1 bg-brand-yellow/10 text-brand-yellow text-xs font-bold rounded-md">{t('common.moderate')}</span>;
      case 'LOW': return <span className="px-2.5 py-1 bg-brand-teal/10 text-brand-teal text-xs font-bold rounded-md">{t('common.low')}</span>;
      default: return <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-md">{t('common.none')}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">{t('herdManagement')}</h1>
          <p className="text-brand-text-secondary mt-1">{t('herdPage.subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder={t('herdPage.search')}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/50"
            />
          </div>
          <button type="button" aria-label={t('herdPage.filter')} title={t('herdPage.filter')} className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-brand-text-secondary font-semibold">
                <th className="p-4 pl-6">{t('common.animal')}</th>
                <th className="p-4">{t('breed')}</th>
                <th className="p-4">{t('common.lactation')}</th>
                <th className="p-4">{t('common.latestEc')}</th>
                <th className="p-4">{t('temperature')}</th>
                <th className="p-4">{t('common.prototypeSignal')}</th>
                <th className="p-4">{t('common.status')}</th>
                <th className="p-4 pr-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4 pl-6"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="p-4 pr-6"></td>
                  </tr>
                ))
              ) : animals.map((animal) => (
                <tr 
                  key={animal.id} 
                  onClick={() => navigate(`/animal/${animal.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  <td className="p-4 pl-6 font-bold text-brand-navy">{animal.tag_number}</td>
                  <td className="p-4 text-sm text-brand-text-secondary">{animal.breed}</td>
                  <td className="p-4 text-sm text-brand-text-secondary">{animal.lactation_number}</td>
                  <td className="p-4 text-sm text-brand-text-secondary font-mono">
                    {animal.prediction?.latest_ec || animal.baseline_ec} mS/cm
                  </td>
                  <td className="p-4 text-sm text-brand-text-secondary font-mono">
                    {animal.prediction?.latest_temp || animal.baseline_temp}°C
                  </td>
                  <td className="p-4 text-sm font-bold text-brand-navy">
                    {animal.prediction ? `${Math.round(animal.prediction.risk_7day * 100)}%` : '-'}
                  </td>
                  <td className="p-4">
                    {getRiskBadge(animal.prediction?.category)}
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand-teal ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && animals.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            {t('herdPage.noAnimals')}
          </div>
        )}
      </div>
    </div>
  );
}
