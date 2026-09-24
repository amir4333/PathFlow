import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Target,
  CheckSquare,
  Clock,
  ArrowLeft,
  Calendar,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { useRouter } from '../../app/providers/RouterProvider';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import {
  Goal,
  Roadmap,
  Task,
  Session,
  RoadmapDetailedProgress,
  ComprehensivePeriodReview,
  calculateComprehensivePeriodReview,
  PeriodSpecification,
  getWeekIdentifier,
  getWeekPeriod,
} from '../../domain';
import { PlannedVsActualDailyChart } from '../progress/PlannedVsActualDailyChart';
import { ActualTimeTrendChart } from '../progress/ActualTimeTrendChart';
import { TaskCompletionTrendChart } from '../progress/TaskCompletionTrendChart';
import { TeacherTimelineSection, TimelineEventItem } from './TeacherTimelineSection';

type PeriodType = 'this-week' | 'last-week' | 'custom';

export interface TeacherRoadmapDetailViewProps {
  readonly roadmapId: string;
}

export const TeacherRoadmapDetailView: React.FC<TeacherRoadmapDetailViewProps> = ({ roadmapId }) => {
  const { navigate } = useRouter();
  const application = useApplication();
  const { preferences, formatDate, formatTime, formatDurationHoursMinutes, formatNumeral } =
    useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  // Review Period State
  const [periodType, setPeriodType] = useState<PeriodType>('this-week');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Data State
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [parentGoal, setParentGoal] = useState<Goal | null>(null);
  const [roadmapProgress, setRoadmapProgress] = useState<RoadmapDetailedProgress | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [roadmapSessions, setRoadmapSessions] = useState<Session[]>([]);
  const [periodReview, setPeriodReview] = useState<ComprehensivePeriodReview | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventItem[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Roadmap
      const foundRoadmap = await application.roadmaps.getRoadmap(roadmapId);
      if (!foundRoadmap) {
        setRoadmap(null);
        setIsLoading(false);
        return;
      }
      setRoadmap(foundRoadmap);

      // 2. Fetch Parent Goal, Progress, Tasks, Sessions, Plans
      const [goal, prog, rTasks, allSessions, allPlans] = await Promise.all([
        application.goals.getGoal(foundRoadmap.goalId),
        application.progress.getRoadmapProgress(roadmapId),
        application.tasks.listTasksForRoadmap(roadmapId),
        application.sessions.getAllSessions(),
        application.weeklyPlans.listWeeklyPlans(),
      ]);

      setParentGoal(goal);
      setRoadmapProgress(prog);
      setTasks(rTasks);

      const taskIds = new Set(rTasks.map((t) => t.id));
      const sessions = allSessions.filter((s) => taskIds.has(s.taskId));
      setRoadmapSessions(sessions);

      // 3. Resolve Period Specification
      let periodSpec: PeriodSpecification;
      const ref = new Date();

      if (periodType === 'this-week') {
        const weekId = getWeekIdentifier(ref);
        const weekRange = getWeekPeriod(weekId);
        periodSpec = {
          type: 'this-week',
          startDate: weekRange.startDate,
          endDate: weekRange.endDate,
          weekIdentifier: weekId,
          label: `This Week (${weekId})`,
        };
      } else if (periodType === 'last-week') {
        const prevDate = new Date(ref.getTime() - 7 * 24 * 3600 * 1000);
        const prevWeekId = getWeekIdentifier(prevDate);
        const prevWeekRange = getWeekPeriod(prevWeekId);
        periodSpec = {
          type: 'last-week',
          startDate: prevWeekRange.startDate,
          endDate: prevWeekRange.endDate,
          weekIdentifier: prevWeekId,
          label: `Last Week (${prevWeekId})`,
        };
      } else {
        periodSpec = {
          type: 'custom',
          startDate: customStartDate,
          endDate: customEndDate,
          label: `Custom Range (${customStartDate} – ${customEndDate})`,
        };
      }

      // 4. Derive period review specifically for this roadmap
      const pReview = calculateComprehensivePeriodReview({
        period: periodSpec,
        sessions,
        tasks: rTasks,
        roadmaps: [foundRoadmap],
        goals: goal ? [goal] : [],
        weeklyPlans: allPlans,
      });
      setPeriodReview(pReview);

      // 5. Reconstruct Activity Timeline for this roadmap (newest-first)
      const events: TimelineEventItem[] = [];

      for (const t of rTasks) {
        if (t.status === 'completed' && t.completedAt) {
          events.push({
            id: `task-completed-${t.id}`,
            type: 'task_completed',
            timestamp: t.completedAt,
            title: t.title,
            badge: 'Task Completed',
          });
        }
      }

      for (const s of sessions) {
        const t = rTasks.find((tsk) => tsk.id === s.taskId);
        events.push({
          id: `session-${s.id}`,
          type: 'session_recorded',
          timestamp: s.startedAt,
          title: t?.title ?? `Task #${s.taskId.slice(0, 8)}`,
          badge: 'Session',
          durationMinutes: s.durationMinutes,
          notes: (s as any).notes,
        });
      }

      events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      setTimelineEvents(events);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load Roadmap details.');
    } finally {
      setIsLoading(false);
    }
  }, [application, roadmapId, periodType, customStartDate, customEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // If roadmap not found
  if (!isLoading && !error && !roadmap) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <button
          type="button"
          onClick={() => navigate('teacher-view')}
          className="inline-flex items-center space-x-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('backToOverview')}</span>
        </button>

        <div className="p-8 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('roadmapNotFound')}
          </h2>
          <button
            type="button"
            onClick={() => navigate('teacher-view')}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-medium cursor-pointer"
          >
            {t('backToOverview')}
          </button>
        </div>
      </div>
    );
  }

  const localizedRangeString = periodReview
    ? `${formatDate(periodReview.period.startDate, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })} – ${formatDate(periodReview.period.endDate, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}`
    : '';

  return (
    <div id="teacher-roadmap-detail-root" className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* 1. Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 flex-wrap">
        <button
          type="button"
          onClick={() => navigate('teacher-view')}
          className="hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer"
        >
          {t('teacherViewTitle')}
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
        {parentGoal && (
          <>
            <button
              type="button"
              onClick={() => navigate(`teacher-view/goal/${parentGoal.id}`)}
              className="hover:text-neutral-900 dark:hover:text-neutral-100 transition truncate max-w-xs cursor-pointer"
            >
              {parentGoal.title}
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          </>
        )}
        <span className="text-neutral-900 dark:text-neutral-100 font-semibold truncate max-w-md">
          {roadmap ? roadmap.title : t('roadmapDetails')}
        </span>
      </nav>

      {/* 2. Read-Only Mode Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-900 dark:text-emerald-200 text-xs shadow-2xs">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            <strong className="font-semibold">{t('readOnlyNotice')}:</strong> {t('readOnlyNoticeDesc')}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          {parentGoal && (
            <button
              type="button"
              onClick={() => navigate(`teacher-view/goal/${parentGoal.id}`)}
              className="inline-flex items-center space-x-1 font-medium hover:underline text-emerald-800 dark:text-emerald-300 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('backToGoal')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('teacher-view')}
            className="inline-flex items-center space-x-1 font-medium hover:underline text-emerald-800 dark:text-emerald-300 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('backToOverview')}</span>
          </button>
        </div>
      </div>

      {/* 3. Roadmap Header */}
      {roadmap && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2 flex-wrap">
                  <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    {roadmap.title}
                  </h1>
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center space-x-2 flex-wrap">
                  {parentGoal && (
                    <button
                      type="button"
                      onClick={() => navigate(`teacher-view/goal/${parentGoal.id}`)}
                      className="inline-flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                    >
                      <Target className="w-3 h-3" />
                      <span>{t('parentGoal')}: {parentGoal.title}</span>
                    </button>
                  )}
                  <span>•</span>
                  <span>{formatNumeral(tasks.length)} {t('tasksCount')}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={loadData}
              title={t('refresh')}
              aria-label={t('refresh')}
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors self-start md:self-auto cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading && (
        <div className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('loadingProgress')}
          </p>
        </div>
      )}

      {!isLoading && error && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-center space-x-3 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={loadData}
            className="ml-auto underline hover:no-underline text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && roadmapProgress && (
        <>
          {/* 4. Distinction: Overall Progress (Lifetime) vs Selected Period Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box A: Overall Lifetime Progress */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                      {t('lifetimeProgress')} ({t('allTime')})
                    </h2>
                  </div>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatNumeral(roadmapProgress.taskCompletionPercentage)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden mb-4">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, roadmapProgress.taskCompletionPercentage)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">{t('tasksCount')}</span>
                    <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {formatNumeral(roadmapProgress.totalTasks)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">{t('tasksCompleted')}</span>
                    <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {formatNumeral(roadmapProgress.completedTasks)} / {formatNumeral(roadmapProgress.totalTasks)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">{t('actualTime')}</span>
                    <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatDurationHoursMinutes(roadmapProgress.totalActualMinutes)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">{t('sessionsCount')}</span>
                    <span className="font-bold text-sm text-purple-600 dark:text-purple-400">
                      {formatNumeral(roadmapProgress.sessionCount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Box B: Selected Period Activity & Controls */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    {t('selectedPeriodActivity')}
                  </h2>
                </div>

                {/* Period Selector Tabs */}
                <div className="inline-flex p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-medium self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setPeriodType('this-week')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      periodType === 'this-week'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    {t('thisWeek')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodType('last-week')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      periodType === 'last-week'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    {t('lastWeek')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodType('custom')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      periodType === 'custom'
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    {t('customRange')}
                  </button>
                </div>
              </div>

              {/* Custom Date Pickers */}
              {periodType === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 text-xs bg-neutral-50 dark:bg-neutral-800/40 p-2.5 rounded-lg">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 rounded"
                  />
                  <span>–</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 rounded"
                  />
                  <button
                    type="button"
                    onClick={loadData}
                    className="px-2.5 py-1 rounded bg-emerald-600 text-white font-medium ml-auto cursor-pointer"
                  >
                    {t('applyRange')}
                  </button>
                </div>
              )}

              {/* Period Metrics */}
              {periodReview && (
                <div className="space-y-2">
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {periodReview.period.label} • {localizedRangeString}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/60">
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block">{t('actualTime')}</span>
                      <span className="font-bold text-sm text-emerald-800 dark:text-emerald-200 font-mono">
                        {formatDurationHoursMinutes(periodReview.summary.totalActualMinutes)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/60">
                      <span className="text-[11px] text-blue-700 dark:text-blue-300 block">{t('plannedTime')}</span>
                      <span className="font-bold text-sm text-blue-800 dark:text-blue-200 font-mono">
                        {formatDurationHoursMinutes(periodReview.summary.totalPlannedMinutes)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-800 col-span-2 sm:col-span-1">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">{t('tasksWorkedOn')}</span>
                      <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                        {formatNumeral(periodReview.summary.tasksWorkedOnCount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 5. Task History for this Roadmap */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-5 h-5 text-blue-500" />
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('tasksInRoadmap')}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                  {formatNumeral(tasks.length)}
                </span>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                {t('noTasksInRoadmap')}
              </div>
            ) : (
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold select-none">
                    <tr>
                      <th className="py-2.5 px-4">{t('allTasks')}</th>
                      <th className="py-2.5 px-4">{t('status')}</th>
                      <th className="py-2.5 px-4 hidden sm:table-cell">{t('priority')}</th>
                      <th className="py-2.5 px-4 text-right">{t('estimatedTime')}</th>
                      <th className="py-2.5 px-4 text-right">{t('actualTime')}</th>
                      <th className="py-2.5 px-4 text-right hidden md:table-cell">{t('sessionsRecordedCount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                    {tasks.map((task) => {
                      const tSessions = roadmapSessions.filter((s) => s.taskId === task.id);
                      const tActualMinutes = tSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
                      const isExpanded = expandedTaskId === task.id;

                      return (
                        <React.Fragment key={task.id}>
                          <tr
                            onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                            className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition cursor-pointer"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    task.status === 'completed'
                                      ? 'bg-emerald-500'
                                      : task.status === 'in_progress'
                                      ? 'bg-blue-500'
                                      : 'bg-neutral-300 dark:bg-neutral-600'
                                  }`}
                                />
                                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                  {task.title}
                                </span>
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 ml-1" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400 ml-1" />
                                )}
                              </div>
                              {task.completedAt && (
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 ml-4">
                                  {t('completionDate')}: {formatDate(task.completedAt, { month: 'short', day: 'numeric' })}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  task.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                    : task.status === 'in_progress'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                                    : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                                }`}
                              >
                                {task.status}
                              </span>
                            </td>

                            <td className="py-3 px-4 hidden sm:table-cell text-neutral-600 dark:text-neutral-400 capitalize">
                              {task.priority}
                            </td>

                            <td className="py-3 px-4 text-right font-mono text-neutral-600 dark:text-neutral-400">
                              {task.estimatedMinutes > 0 ? formatDurationHoursMinutes(task.estimatedMinutes) : '—'}
                            </td>

                            <td className="py-3 px-4 text-right font-mono font-medium text-neutral-900 dark:text-neutral-100">
                              {tActualMinutes > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  {formatDurationHoursMinutes(tActualMinutes)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="py-3 px-4 text-right font-mono text-neutral-600 dark:text-neutral-400 hidden md:table-cell">
                              {formatNumeral(tSessions.length)}
                            </td>
                          </tr>

                          {/* Expanded Task Details & Session History (Read-Only) */}
                          {isExpanded && (
                            <tr className="bg-neutral-50/70 dark:bg-neutral-950/40">
                              <td colSpan={6} className="px-6 py-4 space-y-3">
                                {task.description && (
                                  <div className="text-xs text-neutral-600 dark:text-neutral-400 max-w-2xl">
                                    <strong className="text-neutral-900 dark:text-neutral-200">Description: </strong>
                                    {task.description}
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                    {t('recentSessions')} ({formatNumeral(tSessions.length)})
                                  </div>

                                  {tSessions.length === 0 ? (
                                    <div className="text-xs text-neutral-400 italic py-1">
                                      {t('noSessionsInPeriod')}
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden text-xs">
                                      {tSessions.map((sess) => (
                                        <div key={sess.id} className="p-2.5 flex items-center justify-between gap-2">
                                          <div className="flex items-center space-x-2">
                                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                                            <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                              {formatDate(sess.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            <span className="text-neutral-400">
                                              {formatTime(sess.startedAt)} – {formatTime(sess.endedAt)}
                                            </span>
                                          </div>
                                          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                            {formatDurationHoursMinutes(sess.durationMinutes)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 6. Historical Progress Visualizations (Period-specific breakdown) */}
          {periodReview && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('historicalProgress')} — {periodReview.period.label}
                </h2>
              </div>

              {/* Planned vs Actual Daily */}
              <PlannedVsActualDailyChart dailyBreakdown={periodReview.dailyBreakdown} />

              {/* Actual Time Trend & Task Completion Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActualTimeTrendChart dailyBreakdown={periodReview.dailyBreakdown} />
                <TaskCompletionTrendChart dailyBreakdown={periodReview.dailyBreakdown} />
              </div>
            </div>
          )}

          {/* 7. Activity Timeline for this Roadmap */}
          <TeacherTimelineSection
            events={timelineEvents}
            title={`${t('activityTimeline')} — ${roadmap.title}`}
          />
        </>
      )}
    </div>
  );
};
