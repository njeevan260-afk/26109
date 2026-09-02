import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Map as MapIcon, Bell, ClipboardPlus, Settings, X } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../auth/AuthContext';
import { useTranslation } from 'react-i18next';
import { getDashboardPath } from '../../auth/dashboardPath';

const roleLabelKeys = {
  ADMIN: 'roles.admin',
  DAIRY_FARMER: 'roles.farmer',
  VETERINARIAN: 'roles.veterinarian',
  DAIRY_COOPERATIVE: 'roles.cooperative',
  ANIMAL_HEALTH_AUTHORITY: 'roles.authority',
};

export default function Sidebar({ isMobileOpen, onClose }: { isMobileOpen?: boolean, onClose?: () => void }) {
  const location = useLocation();
  const { identity, hasPermission } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navItems = [
    { name: identity?.role === 'ADMIN' ? t('nav.adminControl') : t('dashboard'), path: getDashboardPath(identity), icon: LayoutDashboard, visible: true },
    { name: t('herdManagement'), path: '/herd', icon: Users, visible: hasPermission('animals.read') },
    { name: t('analyticsGIS'), path: '/analytics', icon: MapIcon, visible: hasPermission('clusters.read') },
    { name: t('alertsCenter'), path: '/alerts', icon: Bell, visible: hasPermission('alerts.read') },
    { name: t('clinicalEvents'), path: '/events', icon: ClipboardPlus, visible: hasPermission('events.read') },
    { name: t('settings'), path: '/settings', icon: Settings, visible: true },
  ].filter(item => item.visible);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={onClose}
        />
      )}
      
      <div className={clsx(
        "fixed inset-y-0 z-50 md:relative md:flex flex-col w-64 bg-brand-navy text-white min-h-screen transition-transform transform md:translate-x-0",
        isRtl ? "right-0" : "left-0",
        isMobileOpen ? "translate-x-0" : isRtl ? "translate-x-full" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐄</span>
            <span className="font-bold text-lg tracking-wide">Herd Vitals</span>
          </div>
          <button type="button" aria-label={t('nav.closeMenu')} className="md:hidden text-gray-400 hover:text-white" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium text-sm",
                  isActive 
                    ? "bg-brand-teal text-white" 
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-white/10 text-xs text-gray-400">
          <p className="font-semibold text-gray-200">{identity?.role ? t(roleLabelKeys[identity.role]) : t('nav.approvedUser')}</p>
          <p className="mt-1">{t('nav.predictionEngine')}</p>
        </div>
      </div>
    </>
  );
}
