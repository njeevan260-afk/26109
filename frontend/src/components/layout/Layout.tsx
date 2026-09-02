import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useEffect, useState } from 'react';
import { fetchHardwareStatus } from '../../lib/api';
import { HardwareStatus } from '../../types';

const HARDWARE_STATUS_POLL_INTERVAL_MS = 30_000;

export default function Layout() {
  const [hardware, setHardware] = useState<HardwareStatus | undefined>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let active = true;

    const refreshHardwareStatus = async () => {
      const latestStatus = await fetchHardwareStatus();
      if (active && latestStatus) setHardware(latestStatus);
    };

    void refreshHardwareStatus();
    const intervalId = window.setInterval(
      () => void refreshHardwareStatus(),
      HARDWARE_STATUS_POLL_INTERVAL_MS,
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshHardwareStatus();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg relative">
      <Sidebar isMobileOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
        <Topbar hardware={hardware} onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
