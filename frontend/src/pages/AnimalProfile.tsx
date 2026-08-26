import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchAnimals, fetchPrediction, recomputePrediction, fetchSensorReadings, subscribeToSensors } from '../lib/api';
import { Animal, Prediction, SensorReading } from '../types';
import { Activity, ArrowUpRight, Info, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function AnimalProfile() {
  const { id } = useParams<{ id: string }>();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [sensorData, setSensorData] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    
    const load = async () => {
      const animals = await fetchAnimals();
      const match = animals.find(a => a.id === id);
      if (match) setAnimal(match);
      
      try {
        const pred = await fetchPrediction(id);
        if (pred) setPrediction(pred);
      } catch (e) {}
      
      const readings = await fetchSensorReadings(id);
      setSensorData(readings.sort((a, b) => new Date(a.reading_time).getTime() - new Date(b.reading_time).getTime()));
      setLoading(false);
    };
    
    load();
    
    // Subscribe to realtime updates for this animal
    const unsubscribe = subscribeToSensors((newReading) => {
      if (newReading.animal_id === id) {
        setSensorData(prev => {
          const updated = [...prev, newReading];
          // Keep only last 100 to prevent bloat
          return updated.slice(-100);
        });
        
        // Also update prediction latest values for demo purposes
        setPrediction(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            latest_ec: newReading.sensor_type === 'EC' ? newReading.value : prev.latest_ec,
            latest_temp: newReading.sensor_type === 'TEMP' ? newReading.value : prev.latest_temp,
          };
        });
      }
    });
    
    return () => unsubscribe();
  }, [id]);

  const handleRecompute = async () => {
    if (!id) return;
    setRefreshing(true);
    setError(null);
    try {
      setPrediction(await recomputePrediction(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh risk');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div className="p-8 animate-pulse text-brand-text-secondary">Loading profile...</div>;
  }
  if (!animal) {
    return <div className="p-8 text-brand-red">Animal not found.</div>;
  }

  // Group sensor data by timestamp for the chart
  const chartDataMap = new Map();
  sensorData.forEach(r => {
    const time = new Date(r.reading_time).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    if (!chartDataMap.has(time)) chartDataMap.set(time, { time });
    
    if (r.sensor_type === 'EC') chartDataMap.get(time).ec = r.value;
    if (r.sensor_type === 'TEMP') chartDataMap.get(time).temp = r.value;
  });
  const chartData = Array.from(chartDataMap.values());

  const getRiskColor = (cat?: string) => {
    if (cat === 'HIGH') return 'bg-brand-red text-white';
    if (cat === 'MODERATE') return 'bg-brand-yellow text-white';
    if (cat === 'LOW') return 'bg-brand-teal text-white';
    return 'bg-gray-200 text-gray-700';
  };

  const getRiskBg = (cat?: string) => {
    if (cat === 'HIGH') return 'bg-red-50 border-red-100';
    if (cat === 'MODERATE') return 'bg-yellow-50 border-yellow-100';
    if (cat === 'LOW') return 'bg-teal-50 border-teal-100';
    return 'bg-gray-50 border-gray-100';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className={`p-6 rounded-2xl shadow-sm border ${getRiskBg(prediction?.category)} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-4xl shadow-inner border-2 border-white">
            🐄
          </div>
          <div>
            <h1 className="text-3xl font-bold text-brand-navy">{animal.tag_number}</h1>
            <p className="text-brand-text-secondary">{animal.breed} • Lactation {animal.lactation_number}</p>
          </div>
          {prediction && (
            <div className={`ml-4 px-4 py-2 rounded-lg font-bold text-sm tracking-wide shadow-sm ${getRiskColor(prediction.category)}`}>
              {prediction.category} RISK
            </div>
          )}
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={handleRecompute}
            disabled={refreshing}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-semibold hover:bg-brand-navy/90 shadow-sm transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Recomputing...' : 'Recompute Risk'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-brand-red">
          {error}
        </div>
      )}

      {prediction && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info className="h-4 w-4" />
          <span className="font-semibold">{prediction.model_mode === 'random_forest' ? 'Prototype ML' : 'Heuristic'} mode</span>
          <span>·</span>
          <span>{prediction.data_source === 'live' ? 'Live sensor data' : 'Simulated sensor data'}</span>
          {prediction.note && <span className="text-blue-700">· {prediction.note}</span>}
        </div>
      )}

      {/* Vitals Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Current EC */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-brand-text-secondary mb-2">Current EC</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-brand-navy font-mono">{prediction?.latest_ec || animal.baseline_ec}</h3>
            <span className="text-sm text-gray-500 mb-1">mS/cm</span>
          </div>
          {prediction && (
            <div className="mt-3 text-sm flex items-center gap-1 font-medium">
              {prediction.ec_deviation > 0 ? (
                <><ArrowUpRight className="w-4 h-4 text-brand-red" /><span className="text-brand-red">+{prediction.ec_deviation}</span></>
              ) : (
                <><span className="text-brand-teal">Normal</span></>
              )}
              <span className="text-gray-400 font-normal ml-1">vs {animal.baseline_ec} baseline</span>
            </div>
          )}
        </div>

        {/* Temperature */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-brand-text-secondary mb-2">Temperature</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-brand-navy font-mono">{prediction?.latest_temp || animal.baseline_temp}</h3>
            <span className="text-sm text-gray-500 mb-1">°C</span>
          </div>
          {prediction && (
            <div className="mt-3 text-sm flex items-center gap-1 font-medium">
              {prediction.temp_deviation > 0 ? (
                <><ArrowUpRight className="w-4 h-4 text-brand-red" /><span className="text-brand-red">+{prediction.temp_deviation}</span></>
              ) : (
                <><span className="text-brand-teal">Normal</span></>
              )}
              <span className="text-gray-400 font-normal ml-1">vs {animal.baseline_temp} baseline</span>
            </div>
          )}
        </div>

        {/* 7-Day Risk */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-brand-text-secondary mb-2">7-Day Risk</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-brand-navy font-mono">{prediction ? Math.round(prediction.risk_7day * 100) : '-'}%</h3>
          </div>
          <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full ${prediction?.category === 'HIGH' ? 'bg-brand-red' : prediction?.category === 'MODERATE' ? 'bg-brand-yellow' : 'bg-brand-teal'}`}
              style={{ width: `${prediction ? prediction.risk_7day * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* History */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-brand-text-secondary mb-2">History</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-brand-navy font-mono">{animal.previous_mastitis_count}</h3>
          </div>
          <p className="mt-3 text-sm text-brand-text-secondary font-medium">Previous mastitis events</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Explainable AI */}
        {prediction && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-brand-navy" />
              <h2 className="text-xl font-bold text-brand-navy">Why is this animal at risk?</h2>
            </div>
            
            <div className="space-y-5">
              {[
                { label: 'EC Trend', value: prediction.factors.ec_trend, color: 'bg-brand-red' },
                { label: 'Temperature Deviation', value: prediction.factors.temp_deviation, color: 'bg-brand-yellow' },
                { label: 'History', value: prediction.factors.history, color: 'bg-brand-teal' },
                { label: 'Rolling Average', value: prediction.factors.rolling_avg, color: 'bg-gray-400' },
              ].sort((a, b) => b.value - a.value).map((factor, i) => {
                const pct = Math.round(factor.value * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm font-semibold mb-1">
                      <span className="text-brand-text-primary">{factor.label}</span>
                      <span className="text-brand-text-secondary">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-sm h-3">
                      <div className={`h-3 rounded-sm ${factor.color}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {prediction && prediction.recommendations.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-yellow/30 bg-yellow-50/10">
            <div className="flex items-center gap-2 mb-6">
              <Info className="w-5 h-5 text-brand-navy" />
              <h2 className="text-xl font-bold text-brand-navy">Recommendations</h2>
            </div>
            <ul className="space-y-3">
              {prediction.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm items-start">
                  <div className="mt-0.5 min-w-[20px]">
                    <div className="w-5 h-5 rounded border-2 border-brand-navy/20 flex items-center justify-center"></div>
                  </div>
                  <span className="text-sm font-medium text-brand-navy leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Vitals Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-brand-navy mb-6">Vitals History (Last 30 Days)</h2>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#636E72' }} axisLine={false} tickLine={false} dy={10} minTickGap={30} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#636E72' }} axisLine={false} tickLine={false} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#636E72' }} axisLine={false} tickLine={false} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: 'var(--color-brand-navy)', marginBottom: '4px' }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
              <Line yAxisId="left" type="monotone" dataKey="ec" name="EC (mS/cm)" stroke="var(--color-brand-teal)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="temp" name="Temp (°C)" stroke="var(--color-brand-red)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
