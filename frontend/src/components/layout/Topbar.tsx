import { Search, Bell, Menu, LogOut, Radio } from 'lucide-react';
import { HardwareStatus } from '../../types';
import { useAuth } from '../../auth/AuthContext';
import { useTranslation } from 'react-i18next';
import { languageOptions } from '../../i18n/resources';
import { NavLink, useNavigate } from 'react-router-dom';

const roleLabelKeys = {
  ADMIN: 'roles.admin',
  DAIRY_FARMER: 'roles.farmer',
  VETERINARIAN: 'roles.veterinarian',
  DAIRY_COOPERATIVE: 'roles.cooperative',
  ANIMAL_HEALTH_AUTHORITY: 'roles.authority',
};

interface TopbarProps {
  hardware?: HardwareStatus;
  onMenuClick?: () => void;
}

export default function Topbar({ hardware, onMenuClick }: TopbarProps) {
  const { identity, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20">
      
      {/* Mobile Menu & Logo */}
      <div className="flex items-center gap-4 md:hidden">
        <button type="button" aria-label={t('nav.closeMenu')} className="text-gray-500 hover:text-brand-navy" onClick={onMenuClick}>
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold text-lg text-brand-navy">🐄 Herd Vitals</span>
      </div>

      {/* Search */}
      <div className="hidden md:flex flex-1 max-w-md relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
          type="text" 
          placeholder={t('nav.search')}
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/50 transition-shadow"
        />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3 md:gap-6">

        <NavLink
          to="/real-readings"
          aria-label={t('nav.openRealReadings')}
          className={({ isActive }) =>
            `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'border-brand-teal bg-brand-teal text-white'
                : 'border-brand-teal/30 bg-brand-teal/5 text-brand-navy hover:bg-brand-teal/10'
            }`
          }
        >
          <Radio className="h-4 w-4" />
          <span className="hidden xl:inline">{t('nav.realReadings')}</span>
        </NavLink>
        
        {/* Hardware Status */}
        {hardware && (
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium">
            <span className={`w-2.5 h-2.5 rounded-full ${hardware.status === 'online' ? 'bg-brand-teal' : 'bg-brand-red animate-pulse'}`}></span>
            <span className="text-brand-text-secondary">ESP8266 {hardware.status === 'online' ? t('common.online') : t('common.offline')}</span>
          </div>
        )}

        {/* Language */}
        <label className="flex items-center border-gray-200 md:border-l md:border-r md:px-4">
          <span className="sr-only">{t('nav.chooseLanguage')}</span>
          <select
            aria-label={t('nav.chooseLanguage')}
            value={i18n.resolvedLanguage || i18n.language}
            onChange={event => void i18n.changeLanguage(event.target.value)}
            className="max-w-28 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-semibold text-brand-navy outline-none focus:ring-2 focus:ring-brand-teal/50 md:max-w-40"
          >
            {languageOptions.map(language => (
              <option key={language.code} value={language.code}>{language.name}</option>
            ))}
          </select>
        </label>

        {/* Notifications */}
        <button type="button" aria-label={t('nav.notifications')} className="relative text-gray-500 hover:text-brand-navy transition-colors">
          <Bell className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            5
          </span>
        </button>

        <div className="hidden lg:block text-right text-xs">
          <p className="font-bold text-brand-navy">{identity?.display_name || identity?.email || t('nav.signedIn')}</p>
          <p className="text-brand-text-secondary">{identity?.role ? t(roleLabelKeys[identity.role]) : ''}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          aria-label={t('nav.signOut')}
          title={t('nav.signOut')}
          className="text-gray-500 transition-colors hover:text-brand-red"
        >
          <LogOut className="h-5 w-5" />
        </button>

      </div>
    </header>
  );
}
