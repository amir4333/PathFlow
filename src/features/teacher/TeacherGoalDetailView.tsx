import React, { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Layers,
  CheckSquare,
  Clock,
  ArrowLeft,
  Calendar,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { useRouter } from '../../app/providers/RouterProvider';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import {
  Goal,
  Roadmap,
  Task,
  Session,
  GoalDetailedProgress,
  ComprehensivePeriodReview,
  calculateComprehensivePeriodReview,
  PeriodSpecification,
  getWeekIdentifier,
  getWeekPeriod,
  getLastNDaysPeriod,
} from '../../domain';
import { PlannedVsActualDailyChart } from '../progress/PlannedVsActualDailyChart';
import { ActualTimeTrendChart } from '../progress/ActualTimeTrendChart';
import { TaskCompletionTrendChart } from '../progress/TaskCompletionTrendChart';
import { TeacherTimelineSection, TimelineEventItem } from './TeacherTimelineSection';

type PeriodType = 'this-week' | 'last-week' | 'custom';

export interface TeacherGoalDetailViewProps {
  readonly goalId: string;
}

export const TeacherGoalDetailView: React.FC<TeacherGoalDetailViewProps> = ({ goalId }) => {
  const { navigate } = useRouter();
  const application = useApplication();
  const { preferences, formatDate, formatDurationHoursMinutes, formatNumeral } =
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
  const [goal, setGoal] = useState<Goal | null>(null);
  const [goalProgress, setGoalProgress] = useState<GoalDetailedProgress | null>(null);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [periodReview, setPeriodReview] = useState<ComprehensivePeriodReview | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Goal and Overall Lifetime Progress
      const foundGoal = await application.goals.getGoal(goalId);
      if (!foundGoal) {
        setGoal(null);
        setIsLoading(false);
        return;
      }
      setGoal(foundGoal);

      const [prog, allRoadmaps, allTasks, allSessions, allPlans] = await Promise.all([
        application.progress.getGoalProgress(goalId),
        application.roadmaps.listRoadmaps(),
        application.tasks.listTasks(),
        application.sessions.getAllSessions(),
        application.weeklyPlans.listWeeklyPlans(),
      ]);

      setGoalProgress(prog);

      // Filter roadmaps and tasks under this goal
      const goalRoadmaps = allRoadmaps.filter((r) => r.goalId === goalId);
      setRoadmaps(goalRoadmaps);

      const roadmapIds = new Set(goalRoadmaps.map((r) => r.id));
      const goalTasks = allTasks.filter((t) => roadmapIds.has(t.roadmapId));
      setTasks(goalTasks);

      const taskIds = new Set(goalTasks.map((t) => t.id));
      const goalSessions = allSessions.filter((s) => taskIds.has(s.taskId));

      // 2. Resolve Period Specification
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

      // 3. Derive period-specific review for this goal using domain engine
      const pReview = calculateComprehensivePeriodReview({
        period: periodSpec,
        sessions: goalSessions,
        tasks: goalTasks,
        roadmaps: goalRoadmaps,
        goals: [foundGoal],
        weeklyPlans: allPlans,
      });
      setPeriodReview(pReview);

      // 4. Reconstruct Activity Timeline for this goal (newest-first)
      const events: TimelineEventItem[] = [];

      // Add completed tasks
      for (const t of goalTasks) {
        if (t.status === 'completed' && t.completedAt) {
          const r = goalRoadmaps.find((rm) => rm.id === t.roadmapId);
          events.push({
            id: `task-completed-${t.id}`,
            type: 'task_completed',
            timestamp: t.completedAt,
            title: t.title,
            subtitle: r ? `Roadmap: ${r.title}` : undefined,
            badge: 'Task Completed',
          });
        }
      }

      // Add recorded sessions
      for (const s of goalSessions) {
        const t = goalTasks.find((tsk) => tsk.id === s.taskId);
        const r = t ? goalRoadmaps.find((rm) => rm.id === t.roadmapId) : undefined;
        events.push({
          id: `session-${s.id}`,
          type: 'session_recorded',
          timestamp: s.startedAt,
          title: t?.title ?? `Task #${s.taskId.slice(0, 8)}`,
          subtitle: r ? `Roadmap: ${r.title}` : undefined,
          badge: 'Session',
          durationMinutes: s.durationMinutes,
          notes: (s as any).notes,
        });
      }

      // Sort timeline events newest-first
      events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      setTimelineEvents(events);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load Goal details.');
    } finally {
      setIsLoading(false);
    }
  }, [application, goalId, periodType, customStartDate, customEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // If goal was not found
  if (!isLoading && !error && !goal) {
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
            {t('goalNotFound')}
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
    <div id="teacher-goal-detail-root" className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* 1. Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <button
          type="button"
          onClick={() => navigate('teacher-view')}
          className="hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer"
        >
          {t('teacherViewTitle')}
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
        <span className="text-neutral-900 dark:text-neutral-100 font-semibold truncate max-w-md">
          {goal ? goal.title : t('goalDetails')}
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
        <button
          type="button"
          onClick={() => navigate('teacher-view')}
          className="inline-flex items-center space-x-1 font-medium hover:underline text-emerald-800 dark:text-emerald-300 self-start sm:self-auto cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('backToOverview')}</span>
        </button>
      </div>

      {/* 3. Goal Header & Description */}
      {goal && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2 flex-wrap">
                  <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    {goal.title}
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
                    {goal.status}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('goalDetails')} • {formatNumeral(roadmaps.length)} {t('roadmapsCount')} • {formatNumeral(tasks.length)} {t('tasksCount')}
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

          {goal.description && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-3xl leading-relaxed pt-1">
              {goal.description}
            </p>
          )}
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading && (
        <div className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
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

      {!isLoading && !error && goalProgress && (
        <>
          {/* 4. Distinction: Overall Progress (Lifetime) vs Selected Period Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box A: Overall Lifetime Progress */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                      {t('lifetimeProgress')} ({t('allTime')})
                    </h2>
                  </div>
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {formatNumeral(goalProgress.taskCompletionPercentage)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden mb-4">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, goalProgress.taskCompletionPercentage)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">{t('roadmapsCount')}</span>
                    <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {formatNumeral(goalProgress.totalRoadmaps)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">{t('tasksCompleted')}</span>
                    <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {formatNumeral(goalProgress.completedTasks)} / {formatNumeral(goalProgress.totalTasks)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">{t('actualTime')}</span>
                    <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatDurationHoursMinutes(goalProgress.totalActualMinutes)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">{t('sessionsCount')}</span>
                    <span className="font-bold text-sm text-purple-600 dark:text-purple-400">
                      {formatNumeral(goalProgress.sessionCount)}
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

          {/* 5. Goal Roadmap Breakdown */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('roadmapBreakdown')}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                  {formatNumeral(roadmaps.length)}
                </span>
              </div>
            </div>

            {roadmaps.length === 0 ? (
              <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                {t('noRoadmapsInGoal')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roadmaps.map((roadmap) => {
                  const rProg = goalProgress.roadmaps.find((r) => r.roadmapId === roadmap.id);
                  const progressPct = rProg ? rProg.taskCompletionPercentage : 0;
                  const totalT = rProg ? rProg.totalTasks : 0;
                  const compT = rProg ? rProg.completedTasks : 0;
                  const actualM = rProg ? rProg.totalActualMinutes : 0;
                  const estM = rProg ? rProg.totalEstimatedMinutes : 0;

                  return (
                    <div
                      key={roadmap.id}
                      className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-neutral-50/40 dark:bg-neutral-800/30 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                            {roadmap.title}
                          </h3>
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 shrink-0">
                            {formatNumeral(progressPct)}%
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 overflow-hidden mb-3">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, progressPct)}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <div>
                            {t('tasksCount')}: {formatNumeral(compT)} / {formatNumeral(totalT)}
                          </div>
                          <div className="text-right font-mono">
                            {formatDurationHoursMinutes(actualM)} {t('actualTime')}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                        <span className="text-[11px] text-neutral-400">
                          {t('estimatedTime')}: {formatDurationHoursMinutes(estM)}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate(`teacher-view/roadmap/${roadmap.id}`)}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          <span>{t('drillDownToRoadmap')}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. Historical Progress Visualizations (Period-specific breakdown) */}
          {periodReview && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
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

          {/* 7. Activity Timeline for this Goal */}
          <TeacherTimelineSection
            events={timelineEvents}
            title={`${t('activityTimeline')} — ${goal.title}`}
          />
        </>
      )}
    </div>
  );
};
