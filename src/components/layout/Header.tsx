import React from 'react';
import { useRouter } from '../../app/providers/RouterProvider';
import { APP_ROUTES } from '../../app/routes/routes';
import { useActiveSession } from '../../features/sessions/ActiveSessionContext';
import { useUserPreferences } from '../../app/preferences';
import { Menu, ShieldCheck, WifiOff, Clock, Settings } from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { currentRoute, params, navigate } = useRouter();
  const { activeSession, activeTask, formattedTime } = useActiveSession();
  const { preferences } = useUserPreferences();
  const activeRoute = APP_ROUTES.find((r) => r.id === currentRoute) || APP_ROUTES[0];

  return (
    <header
      id="app-header"
      className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30"
    >
      <div className="flex items-center gap-3">
        <button
          id="btn-open-mobile-menu"
          onClick={onOpenMobileMenu}
          aria-label="Open Navigation Menu"
          className="md:hidden p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-neutral-400 font-medium">PathFlow</span>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {activeRoute.label}
          </span>
          {params.id && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700">/</span>
              <span className="text-neutral-500 font-mono text-xs">
                {params.id.slice(0, 8)}...
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Active Session Ticker */}
        {activeSession && (
          <button
            id="header-active-session-indicator"
            onClick={() => navigate('sessions')}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer transition shadow-2xs"
            title="Active session in progress. Click to view timer."
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-mono font-bold tracking-tight">{formattedTime}</span>
            <span className="hidden md:inline max-w-[120px] truncate text-neutral-600 dark:text-neutral-300 text-[11px]">
              {activeTask?.title || 'Session'}
            </span>
          </button>
        )}

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Phase 9A Active</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
          <WifiOff className="w-3.5 h-3.5 text-neutral-500" />
          <span>Offline-First</span>
        </div>

        {/* Settings button */}
        <button
          id="btn-header-settings"
          onClick={() => navigate('settings')}
          className={`p-1.5 rounded-lg border text-xs cursor-pointer transition flex items-center gap-1.5 ${
            currentRoute === 'settings'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white'
              : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
          }`}
          title="Settings & Preferences"
          aria-label="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-[10px] font-mono uppercase font-semibold">
            {preferences.language} • {preferences.calendar === 'persian' ? 'FA' : 'EN'}
          </span>
        </button>
      </div>
    </header>
  );
};
