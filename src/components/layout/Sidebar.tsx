import React from 'react';
import { useRouter } from '../../app/providers/RouterProvider';
import { AppRouteId, APP_ROUTES } from '../../app/routes/routes';
import { APP_CONFIG } from '../../app/config/appConfig';
import {
  LayoutDashboard,
  Target,
  MapPin,
  CheckSquare,
  Clock,
  Calendar,
  TrendingUp,
  GraduationCap,
  ShieldAlert,
  Compass,
} from 'lucide-react';

interface SidebarProps {
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const ROUTE_ICONS: Record<AppRouteId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  goals: Target,
  roadmaps: MapPin,
  tasks: CheckSquare,
  sessions: Clock,
  'weekly-plans': Calendar,
  progress: TrendingUp,
  teacher: GraduationCap,
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpenMobile, onCloseMobile }) => {
  const { currentRoute, navigate } = useRouter();

  const handleSelect = (routeId: AppRouteId) => {
    navigate(routeId);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold text-sm tracking-wider">
            PF
          </div>
          <div>
            <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100 leading-none">
              {APP_CONFIG.name}
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">
              Phase 1 Shell
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Overview
          </div>
          <button
            id="nav-link-dashboard"
            onClick={() => handleSelect('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
              currentRoute === 'dashboard'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </button>
        </div>

        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Execution Pipeline
          </div>
          <div className="space-y-1">
            {APP_ROUTES.filter((r) => r.category === 'workflow').map((route) => {
              const Icon = ROUTE_ICONS[route.id];
              const isActive = currentRoute === route.id;
              return (
                <button
                  key={route.id}
                  id={`nav-link-${route.id}`}
                  onClick={() => handleSelect(route.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{route.label}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                        : route.id === 'goals' || route.id === 'roadmaps' || route.id === 'tasks' || route.id === 'sessions'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-semibold'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    {route.id === 'goals' || route.id === 'roadmaps' || route.id === 'tasks' || route.id === 'sessions' ? 'Active' : 'P2+'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Collaboration
          </div>
          {APP_ROUTES.filter((r) => r.category === 'collaboration').map((route) => {
            const Icon = ROUTE_ICONS[route.id];
            const isActive = currentRoute === route.id;
            return (
              <button
                key={route.id}
                id={`nav-link-${route.id}`}
                onClick={() => handleSelect(route.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{route.label}</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                  }`}
                >
                  P4
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Architecture Constraint Footer */}
      <div className="p-3.5 m-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 space-y-1">
        <div className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>Local-First Baseline</span>
        </div>
        <p className="leading-snug text-neutral-500">
          No backend or DB calls in Phase 1. Ready for IndexedDB & PWA in future phases.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        id="app-sidebar-desktop"
        className="hidden md:block w-64 h-screen shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0"
      >
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Mobile Drawer */}
      <div
        id="app-sidebar-mobile"
        className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-neutral-900 z-50 transform transition-transform duration-200 ease-in-out md:hidden border-r border-neutral-200 dark:border-neutral-800 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </div>
    </>
  );
};
