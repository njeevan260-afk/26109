import { useEffect, useState } from 'react';
import { fetchAlerts } from '../lib/api';
import { Alert } from '../types';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export default function AlertsCenter() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MODERATE' | 'RESOLVED' | 'UNRESOLVED'>('ALL');

  useEffect(() => {
    fetchAlerts().then(setAlerts);
  }, []);

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
          <h1 className="text-2xl font-bold text-brand-navy">Alerts Center</h1>
          <p className="text-brand-text-secondary mt-1">Manage system alerts and veterinary notifications</p>
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
            {f === 'ALL' ? 'All Alerts' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[500px]">
        {filteredAlerts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-gray-500">
            <CheckCircle className="w-12 h-12 text-brand-teal/50 mb-4" />
            <p className="text-lg font-medium text-brand-navy">No alerts found</p>
            <p className="mt-1">Everything looks good for this filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAlerts.map(alert => (
              <div key={alert.id} className={clsx(
                "p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between transition-colors hover:bg-gray-50",
                alert.status === 'RESOLVED' && "opacity-60 grayscale-[50%]"
              )}>
                <div className="flex gap-4 items-start sm:items-center">
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    alert.severity === 'HIGH' ? 'bg-red-50 border border-red-100' : 'bg-yellow-50 border border-yellow-100'
                  )}>
                    {getAlertIcon(alert.severity)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/animal/${alert.animal_id}`} className="font-bold text-brand-navy hover:underline text-lg">
                        {alert.animal_id}
                      </Link>
                      {alert.status === 'RESOLVED' && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-bold rounded-md">RESOLVED</span>
                      )}
                    </div>
                    <p className="text-brand-text-secondary text-sm">{alert.message}</p>
                  </div>
                </div>
                
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 pl-14 sm:pl-0">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </div>
                  
                  <div className="flex gap-2">
                    {alert.status === 'UNRESOLVED' && (
                      <button className="px-3 py-1.5 bg-white border border-gray-200 text-brand-text-secondary text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                        Mark Resolved
                      </button>
                    )}
                    <Link to={`/animal/${alert.animal_id}`} className="px-3 py-1.5 bg-brand-navy text-white text-xs font-bold rounded-lg hover:bg-brand-navy/90 transition-colors shadow-sm">
                      View Animal
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
