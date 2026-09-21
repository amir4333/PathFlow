import React, { useEffect, useState } from 'react';
import { useRouter } from '../../app/providers/RouterProvider';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { APP_CONFIG } from '../../app/config/appConfig';
import { APP_ROUTES, AppRouteId } from '../../app/routes/routes';
import {
  Compass,
  CheckCircle2,
  Layers,
  ArrowRight,
  FolderTree,
  Shield,
  Clock,
  Sparkles,
  GitBranch,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { navigate } = useRouter();
  const application = useApplication();
  const [stats, setStats] = useState<{
    goals: number;
    roadmaps: number;
    tasks: number;
    sessions: number;
    weeklyPlans: number;
    activeSessionTask: string | null;
  }>({
    goals: 0,
    roadmaps: 0,
    tasks: 0,
    sessions: 0,
    weeklyPlans: 0,
    activeSessionTask: null,
  });

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const [goals, roadmaps, tasks, sessions, weeklyPlans, activeSession] = await Promise.all([
          application.goals.listGoals(),
          application.roadmaps.listRoadmaps(),
          application.tasks.listTasks(),
          application.sessions.getAllSessions(),
          application.weeklyPlans.listWeeklyPlans(),
          application.sessions.getActiveSession(),
        ]);

        if (isMounted) {
          setStats({
            goals: goals.length,
            roadmaps: roadmaps.length,
            tasks: tasks.length,
            sessions: sessions.length,
            weeklyPlans: weeklyPlans.length,
            activeSessionTask: activeSession ? activeSession.taskId : null,
          });
        }
      } catch (err) {
        console.error('Failed to load application stats', err);
      }
    }
    loadStats();
    return () => {
      isMounted = false;
    };
  }, [application]);

  const featureCards = APP_ROUTES.filter((route) => route.id !== 'dashboard');

  return (
    <div id="dashboard-view" className="max-w-5xl mx-auto space-y-8">
      {/* Welcome & Phase 1 Header */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {APP_CONFIG.currentPhase}
              </span>
              <span className="text-xs text-neutral-500">v{APP_CONFIG.version}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {APP_CONFIG.name}
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl">
              {APP_CONFIG.tagline}. This is the initial Phase 1 foundation shell verifying routing, layout modularity, and strict architectural separation.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-center">
            <span className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-mono border border-neutral-200 dark:border-neutral-700">
              Offline-First Ready
            </span>
          </div>
        </div>

        {/* Core Workflow Visualizer */}
        <div className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Core Workflow Pipeline
            </h2>
            <span className="text-xs text-neutral-400">
              Goal → Roadmap → Task → Session → Time → Progress → Review
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 p-3.5 bg-neutral-50 dark:bg-neutral-950/50 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium">
            {APP_CONFIG.coreWorkflow.map((step, idx) => (
              <React.Fragment key={step}>
                <span className="px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-2xs">
                  {step}
                </span>
                {idx < APP_CONFIG.coreWorkflow.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Application Layer Live State Summary (Phase 7 Integration) */}
      <div id="application-layer-stats" className="p-4 sm:p-5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Application Layer & IndexedDB Store
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
            Active Layer: React UI → Application Services → Repositories → Dexie
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
            <span className="text-xs text-neutral-500 block">Goals</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{stats.goals}</span>
          </div>
          <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
            <span className="text-xs text-neutral-500 block">Roadmaps</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{stats.roadmaps}</span>
          </div>
          <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
            <span className="text-xs text-neutral-500 block">Tasks</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{stats.tasks}</span>
          </div>
          <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
            <span className="text-xs text-neutral-500 block">Sessions</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{stats.sessions}</span>
          </div>
          <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg col-span-2 sm:col-span-1">
            <span className="text-xs text-neutral-500 block">Weekly Plans</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{stats.weeklyPlans}</span>
          </div>
        </div>
      </div>

      {/* Verification Status Checks */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Routing Shell</span>
          </div>
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Zero-Dep Hash Sync</p>
          <p className="text-xs text-neutral-500">8 typed routes responsive to URL navigation & history.</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Architecture</span>
          </div>
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Layer Decoupling</p>
          <p className="text-xs text-neutral-500">Domain, Data, Sync, and Presentation isolated.</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">TypeScript</span>
          </div>
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Strict Type Safety</p>
          <p className="text-xs text-neutral-500">No premature data models or unsafe any casts.</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Dependencies</span>
          </div>
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Minimal Baseline</p>
          <p className="text-xs text-neutral-500">Clean footprint ready for future PWA & IndexedDB.</p>
        </div>
      </div>

      {/* Feature Module Placeholders */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Module Placeholders
            </h2>
            <p className="text-xs text-neutral-500">
              Click any module to inspect its architectural placeholder and Phase 2+ roadmap responsibilities.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-500">
            {featureCards.length} modules registered
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureCards.map((route) => (
            <button
              key={route.id}
              id={`card-nav-${route.id}`}
              onClick={() => navigate(route.id)}
              className="text-left p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-all shadow-2xs group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {route.category}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  {route.id}
                </span>
              </div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-neutral-950 dark:group-hover:text-white flex items-center justify-between">
                <span>{route.label}</span>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 line-clamp-2">
                {route.description}
              </p>
              <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center gap-1.5 text-xs text-neutral-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{route.plannedPhase}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Architectural Philosophy Note */}
      <div className="bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          <Shield className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <span>Architectural Principles Enforced</span>
        </div>
        <ul className="grid sm:grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          {APP_CONFIG.principles.map((principle, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-neutral-400" />
              <span>{principle}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
