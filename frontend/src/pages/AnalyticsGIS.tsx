import { useEffect, useState } from 'react';
import { fetchClusters } from '../lib/api';
import { ClusterFeatureCollection, ClusterFeature } from '../types';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function AnalyticsGIS() {
  const { t } = useTranslation();
  const [clusters, setClusters] = useState<ClusterFeatureCollection | null>(null);
  const [activeCluster, setActiveCluster] = useState<ClusterFeature | null>(null);

  useEffect(() => {
    fetchClusters().then(setClusters);
  }, []);

  const getRiskColor = (risk: string) => {
    if (risk === 'HIGH') return 'var(--color-brand-red)';
    if (risk === 'MODERATE') return 'var(--color-brand-yellow)';
    return 'var(--color-brand-teal)';
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col space-y-6">
      
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">{t('analyticsGIS')}</h1>
        <p className="text-brand-text-secondary mt-1">Geospatial cluster analysis of herd risk levels</p>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Map Container */}
        <div className="flex-1 relative h-[400px] lg:h-auto z-10">
          <MapContainer 
            center={[28.7041, 77.1025]} 
            zoom={16} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {clusters?.features.map((feature, idx) => (
              <Circle
                key={idx}
                center={[feature.geometry.coordinates[1], feature.geometry.coordinates[0]]}
                pathOptions={{
                  fillColor: getRiskColor(feature.properties.risk_level),
                  fillOpacity: 0.4,
                  color: getRiskColor(feature.properties.risk_level),
                  weight: 2
                }}
                radius={40}
                eventHandlers={{
                  click: () => setActiveCluster(feature),
                }}
              >
                <Popup>
                  <div className="font-sans">
                    <h4 className="font-bold text-brand-navy">{feature.properties.cluster_name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{feature.properties.risk_level} RISK</p>
                  </div>
                </Popup>
              </Circle>
            ))}
          </MapContainer>
        </div>

        {/* Side Panel */}
        <div className="w-full lg:w-96 bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-100 p-6 flex flex-col z-20 overflow-y-auto">
          <h2 className="text-lg font-bold text-brand-navy mb-6">Cluster Analysis</h2>
          
          {activeCluster ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-wider mb-1">Cluster Name</p>
                <h3 className="text-xl font-bold text-brand-navy">{activeCluster.properties.cluster_name}</h3>
              </div>
              
              <div>
                <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-wider mb-2">Risk Level</p>
                <span className={`px-4 py-2 text-sm font-bold rounded-lg text-white ${
                  activeCluster.properties.risk_level === 'HIGH' ? 'bg-brand-red' : 
                  activeCluster.properties.risk_level === 'MODERATE' ? 'bg-brand-yellow' : 'bg-brand-teal'
                }`}>
                  {activeCluster.properties.risk_level}
                </span>
              </div>
              
              <div>
                <p className="text-xs font-bold text-brand-text-secondary uppercase tracking-wider mb-3">Affected Animals ({activeCluster.properties.affected_cows.length})</p>
                {activeCluster.properties.affected_cows.length > 0 ? (
                  <div className="space-y-2">
                    {activeCluster.properties.affected_cows.map(cow => (
                      <Link 
                        key={cow} 
                        to={`/animal/${cow}`}
                        className="block w-full p-3 bg-white border border-gray-200 rounded-xl hover:border-brand-teal hover:shadow-sm transition-all"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-brand-navy">{cow}</span>
                          <span className="text-brand-teal text-sm font-medium">{t('viewAnimal')} &rarr;</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">{t('noData')}</p>
                )}
              </div>
              
              <div className="pt-6 border-t border-gray-200">
                <button className="w-full py-3 bg-brand-navy text-white rounded-xl font-bold text-sm hover:bg-brand-navy/90 transition-colors">
                  Generate Cluster Report
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">🗺️</span>
              </div>
              <p>Select a cluster on the map to view detailed risk analysis and affected animals.</p>
            </div>
          )}
          
        </div>
      </div>
      
    </div>
  );
}
