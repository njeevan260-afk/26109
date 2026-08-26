import { Search, Bell, Menu, Activity } from 'lucide-react';
import { HardwareStatus } from '../../types';

interface TopbarProps {
  hardware?: HardwareStatus;
  onMenuClick?: () => void;
}

export default function Topbar({ hardware, onMenuClick }: TopbarProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20">
      
      {/* Mobile Menu & Logo */}
      <div className="flex items-center gap-4 md:hidden">
        <button className="text-gray-500 hover:text-brand-navy" onClick={onMenuClick}>
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold text-lg text-brand-navy">🐄 Herd Vitals</span>
      </div>

      {/* Search */}
      <div className="hidden md:flex flex-1 max-w-md relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search cow ID, tag or symptom... (⌘K)"
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/50 transition-shadow"
        />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-6">
        
        {/* Hardware Status */}
        {hardware && (
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium">
            <span className={`w-2.5 h-2.5 rounded-full ${hardware.status === 'online' ? 'bg-brand-teal' : 'bg-brand-red animate-pulse'}`}></span>
            <span className="text-brand-text-secondary">ESP8266 {hardware.status === 'online' ? 'Online' : 'Offline'}</span>
          </div>
        )}

        {/* Language */}
        <div className="hidden md:flex text-sm font-medium text-gray-500 gap-2 border-l border-r border-gray-200 px-4">
          <button className="text-brand-navy font-bold">EN</button>
          <span>|</span>
          <button className="hover:text-brand-navy">HI</button>
          <span>|</span>
          <button className="hover:text-brand-navy">KN</button>
        </div>

        {/* Notifications */}
        <button className="relative text-gray-500 hover:text-brand-navy transition-colors">
          <Bell className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            5
          </span>
        </button>

      </div>
    </header>
  );
}
