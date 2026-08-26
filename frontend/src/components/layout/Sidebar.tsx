import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Map as MapIcon, Bell, ClipboardPlus, Settings, X } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Herd Management', path: '/herd', icon: Users },
  { name: 'Analytics & GIS', path: '/analytics', icon: MapIcon },
  { name: 'Alerts Center', path: '/alerts', icon: Bell },
  { name: 'Clinical Events', path: '/events', icon: ClipboardPlus },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar({ isMobileOpen, onClose }: { isMobileOpen?: boolean, onClose?: () => void }) {
  const location = useLocation();

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
        "fixed inset-y-0 left-0 z-50 md:relative md:flex flex-col w-64 bg-brand-navy text-white min-h-screen transition-transform transform md:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐄</span>
            <span className="font-bold text-lg tracking-wide">Herd Vitals</span>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.name}
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
          SIH 2026 Prediction Engine
        </div>
      </div>
    </>
  );
}
