import React, { useEffect, useState } from 'react';
import { useRouter } from '../../app/providers/RouterProvider';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useActiveSession } from '../sessions/ActiveSessionContext';
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
  Play,
  Square,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { navigate } = useRouter();
  const application = useApplication();
  const { activeSession, activeTask, formattedTime } = useActiveSession();
  const [stats, setStats] = useState<{
    totalGoals: number;
    activeGoals: number;
    inProgressGoals: number;
    completedGoals: number;
    totalRoadmaps: number;
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    totalSessions: number;
    totalWeeklyPlans: number;
    totalActualMinutes: number;
  }>({
    totalGoals: 0,
    activeGoals: 0,
    inProgressGoals: 0,
    completedGoals: 0,
    totalRoadmaps: 0,
    totalTasks: 0,
    activeTasks: 0,
    completedTasks: 0,
    totalSessions: 0,
    totalWeeklyPlans: 0,
    totalActualMinutes: 0,
  });

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const [goals, roadmaps, tasks, sessions, weeklyPlans] = await Promise.all([
          application.goals.listGoals(),
          application.roadmaps.listRoadmaps(),
          application.tasks.listTasks(),
          application.sessions.getAllSessions(),
          application.weeklyPlans.listWeeklyPlans(),
        ]);

        if (isMounted) {
          const activeGoals = goals.filter((g) => g.status !== 'archived').length;
          const inProgressGoals = goals.filter((g) => g.status === 'in_progress').length;
          const completedGoals = goals.filter((g) => g.status === 'completed').length;
          const activeTasks = tasks.filter((t) => t.status !== 'cancelled' && t.status !== 'completed').length;
          const completedTasks = tasks.filter((t) => t.status === 'completed').length;
          const totalMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);

          setStats({
            totalGoals: goals.length,
            activeGoals,
            inProgressGoals,
            completedGoals,
            totalRoadmaps: roadmaps.length,
            totalTasks: tasks.length,
            activeTasks,
            completedTasks,
            totalSessions: sessions.length,
            totalWeeklyPlans: weeklyPlans.length,
            totalActualMinutes: totalMinutes,
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

      {/* Live Active Focus Session Banner (if running) */}
      {activeSession && (
        <div
          id="dashboard-active-session-banner"
          className="p-5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border-2 border-emerald-500/40 dark:border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-mono font-bold text-lg shrink-0 shadow-xs">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-400">
                  Active Focus Session
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="font-bold text-neutral-900 dark:text-neutral-100 text-base">
                {activeTask?.title || 'Active Task'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold">
                Elapsed
              </div>
              <span className="font-mono text-2xl sm:text-3xl font-bold text-neutral-950 dark:text-white">
                {formattedTime}
              </span>
            </div>
            <button
              onClick={() => navigate('sessions')}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition shadow-xs"
            >
              Open Timer
            </button>
          </div>
        </div>
      )}

      {/* Application Layer Live State Summary (Phase 8 Integration) */}
      <div id="application-layer-stats" className="p-4 sm:p-5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Strategic Portfolio & Pipeline Status
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
            Phase 9A: Active Session & Time Tracking
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <button
            onClick={() => navigate('goals')}
            className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-lg text-left transition cursor-pointer"
          >
            <span className="text-xs text-neutral-500 block">Active Goals</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{stats.activeGoals}</span>
              <span className="text-xs text-neutral-400">/ {stats.totalGoals} total</span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 block">
              {stats.inProgressGoals} in progress
            </span>
          </button>

          <button
            onClick={() => navigate('roadmaps')}
            className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-lg text-left transition cursor-pointer"
          >
            <span className="text-xs text-neutral-500 block">Milestone Roadmaps</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{stats.totalRoadmaps}</span>
              <span className="text-xs text-neutral-400">pathways</span>
            </div>
            <span className="text-[10px] text-neutral-400 mt-1 block">
              Attached to goals
            </span>
          </button>

          <button
            onClick={() => navigate('sessions')}
            className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-lg text-left transition cursor-pointer"
          >
            <span className="text-xs text-neutral-500 block">Time Invested</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{stats.totalActualMinutes}m</span>
              <span className="text-xs text-neutral-400">({stats.totalSessions} sessions)</span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 block">
              Manage / View Timers →
            </span>
          </button>

          <button
            onClick={() => navigate('tasks')}
            className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-lg text-left transition cursor-pointer"
          >
            <span className="text-xs text-neutral-500 block">Tasks</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{stats.activeTasks}</span>
              <span className="text-xs text-neutral-400">/ {stats.totalTasks} total</span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 block">
              {stats.completedTasks} completed
            </span>
          </button>
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
