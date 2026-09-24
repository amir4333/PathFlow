import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Eye,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from '../../app/providers/RouterProvider';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import { ComprehensivePeriodReview, Session, Task, Roadmap, WeeklyPlan } from '../../domain';
import { TeacherSummaryCards } from './TeacherSummaryCards';
import { TeacherGoalRoadmapSection } from './TeacherGoalRoadmapSection';
import { TeacherTaskProgressSection } from './TeacherTaskProgressSection';
import { TeacherWeeklyPlanSection, WeeklyPlanItemPreview } from './TeacherWeeklyPlanSection';
import { TeacherRecentSessionsSection, TeacherSessionItem } from './TeacherRecentSessionsSection';
import { TeacherGoalDetailView } from './TeacherGoalDetailView';
import { TeacherRoadmapDetailView } from './TeacherRoadmapDetailView';

type PeriodType = 'this-week' | 'last-week' | 'custom';

export const TeacherView: React.FC = () => {
  const { params } = useRouter();
  const application = useApplication();
  const { preferences, formatDate, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  // Subview routing for Phase 12B Drill-Down
  if (params.subview === 'goal' && (params.goalId || params.id)) {
    return <TeacherGoalDetailView goalId={params.goalId || params.id} />;
  }

  if (params.subview === 'roadmap' && (params.roadmapId || params.id)) {
    return <TeacherRoadmapDetailView roadmapId={params.roadmapId || params.id} />;
  }

  const [periodType, setPeriodType] = useState<PeriodType>('this-week');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [reviewData, setReviewData] = useState<ComprehensivePeriodReview | null>(null);
  const [periodSessions, setPeriodSessions] = useState<TeacherSessionItem[]>([]);
  const [weeklyPlanItems, setWeeklyPlanItems] = useState<WeeklyPlanItemPreview[]>([]);
  const [datedCommitmentsCount, setDatedCommitmentsCount] = useState<number>(0);
  const [flexibleCommitmentsCount, setFlexibleCommitmentsCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadTeacherData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Get period progress review from application service
      const data = await application.progress.getPeriodProgressReview({
        periodType,
        customStartDate,
        customEndDate,
      });
      setReviewData(data);

      // 2. Fetch tasks, roadmaps, and sessions for enriched read-only details
      const [allTasks, allRoadmaps, sessionHistoryResult] = await Promise.all([
        application.tasks.listTasks(),
        application.roadmaps.listRoadmaps(),
        application.sessions.querySessionHistory({
          startDate: data.period.startDate,
          endDate: data.period.endDate,
        }),
      ]);

      const taskMap = new Map<string, Task>(allTasks.map((t) => [t.id, t]));
      const roadmapMap = new Map<string, Roadmap>(allRoadmaps.map((r) => [r.id, r]));

      // 3. Map sessions with task and roadmap names
      const enrichedSessions: TeacherSessionItem[] = sessionHistoryResult.sessions.map((s) => {
        const task = taskMap.get(s.taskId);
        const roadmap = task ? roadmapMap.get(task.roadmapId) : undefined;
        return {
          id: s.id,
          taskId: s.taskId,
          taskTitle: task?.title,
          roadmapTitle: roadmap?.title,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          durationMinutes: s.durationMinutes,
          notes: (s as any).notes ?? '',
        };
      });
      setPeriodSessions(enrichedSessions);

      // 4. Fetch weekly plan for the period (if week identifier is available)
      if (data.period.weekIdentifier) {
        const plan = await application.weeklyPlans.getWeeklyPlanByWeek(data.period.weekIdentifier);
        if (plan) {
          const itemsPreview: WeeklyPlanItemPreview[] = plan.items.map((item) => {
            const task = taskMap.get(item.taskId);
            return {
              id: item.id,
              taskId: item.taskId,
              taskTitle: task?.title,
              plannedMinutes: item.plannedMinutes,
              targetDate: item.targetDate,
              isCompleted: item.isCompleted,
            };
          });
          setWeeklyPlanItems(itemsPreview);
          setDatedCommitmentsCount(plan.items.filter((i) => !!i.targetDate).length);
          setFlexibleCommitmentsCount(plan.items.filter((i) => !i.targetDate).length);
        } else {
          setWeeklyPlanItems([]);
          setDatedCommitmentsCount(0);
          setFlexibleCommitmentsCount(0);
        }
      } else {
        // Custom range: we can load all plans and match dates in range
        const allPlans = await application.weeklyPlans.listWeeklyPlans();
        const matchingItems: WeeklyPlanItemPreview[] = [];
        let datedCount = 0;
        let flexCount = 0;

        for (const p of allPlans) {
          for (const item of p.items) {
            if (
              item.targetDate &&
              item.targetDate >= data.period.startDate &&
              item.targetDate <= data.period.endDate
            ) {
              const task = taskMap.get(item.taskId);
              matchingItems.push({
                id: item.id,
                taskId: item.taskId,
                taskTitle: task?.title,
                plannedMinutes: item.plannedMinutes,
                targetDate: item.targetDate,
                isCompleted: item.isCompleted,
              });
              datedCount++;
            }
          }
        }
        setWeeklyPlanItems(matchingItems);
        setDatedCommitmentsCount(datedCount);
        setFlexibleCommitmentsCount(flexCount);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load Teacher View data.');
    } finally {
      setIsLoading(false);
    }
  }, [application, periodType, customStartDate, customEndDate]);

  useEffect(() => {
    loadTeacherData();
  }, [loadTeacherData]);

  // Formatted date range string for period banner
  const localizedRangeString = reviewData
    ? `${formatDate(reviewData.period.startDate, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })} – ${formatDate(reviewData.period.endDate, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}`
    : '';

  // Active days count in this period
  const activeDaysCount = reviewData
    ? reviewData.dailyBreakdown.filter((d) => d.actualMinutes > 0 || d.plannedMinutes > 0).length
    : 0;

  return (
    <div id="teacher-view-root" className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* 1. Read-Only Notice Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-900 dark:text-emerald-200 shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm">{t('readOnlyNotice')}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-200/70 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200">
                Observational
              </span>
            </div>
            <p className="text-xs text-emerald-700/90 dark:text-emerald-300/80 mt-0.5">
              {t('readOnlyNoticeDesc')}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 self-start sm:self-auto text-xs font-medium text-emerald-800 dark:text-emerald-300">
          <Eye className="w-4 h-4" />
          <span>{t('teacherViewTitle')}</span>
        </div>
      </div>

      {/* 2. Header & Period Selection Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {t('teacherViewTitle')}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
              <TrendingUp className="w-3 h-3 mr-1" />
              {t('reviewPeriod')}
            </span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {t('teacherViewSubtitle')}
          </p>
        </div>

        {/* Period Selector Tabs & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-neutral-200/70 dark:bg-neutral-800 rounded-xl text-xs font-medium">
            <button
              type="button"
              id="btn-period-this-week"
              onClick={() => setPeriodType('this-week')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodType === 'this-week'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {t('thisWeek')}
            </button>
            <button
              type="button"
              id="btn-period-last-week"
              onClick={() => setPeriodType('last-week')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodType === 'last-week'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {t('lastWeek')}
            </button>
            <button
              type="button"
              id="btn-period-custom"
              onClick={() => setPeriodType('custom')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                periodType === 'custom'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {t('customRange')}
            </button>
          </div>

          <button
            type="button"
            onClick={loadTeacherData}
            title={t('refresh')}
            aria-label={t('refresh')}
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Custom Date Range Pickers (if periodType === 'custom') */}
      {periodType === 'custom' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-2xs flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('fromDate')}:
            </span>
            <input
              type="date"
              id="teacher-custom-start-date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2.5 py-1.5 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('toDate')}:
            </span>
            <input
              type="date"
              id="teacher-custom-end-date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2.5 py-1.5 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={loadTeacherData}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors ml-auto cursor-pointer"
          >
            {t('applyRange')}
          </button>
        </div>
      )}

      {/* Active Period Date Banner */}
      {reviewData && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 rounded-xl text-xs">
          <div className="flex items-center space-x-2 text-neutral-700 dark:text-neutral-300 font-medium">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span>{reviewData.period.label}</span>
            <span className="text-neutral-400 dark:text-neutral-600">•</span>
            <span className="text-neutral-500 dark:text-neutral-400">{localizedRangeString}</span>
          </div>

          {reviewData.period.weekIdentifier && (
            <span className="px-2 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-[11px] font-mono text-neutral-700 dark:text-neutral-300">
              {reviewData.period.weekIdentifier}
            </span>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('loadingProgress')}
          </p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-center space-x-3 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={loadTeacherData}
            className="ml-auto underline hover:no-underline text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State when no activity in period */}
      {!isLoading && !error && reviewData && reviewData.summary.totalPlannedMinutes === 0 && reviewData.summary.totalActualMinutes === 0 && reviewData.goals.length === 0 && (
        <div className="p-8 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('noActivityInPeriod')}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1">
            {t('noActivityInPeriodDesc')}
          </p>
        </div>
      )}

      {/* Main Teacher Dashboard Content */}
      {!isLoading && !error && reviewData && (
        <>
          {/* Section 1: Summary Metric Cards */}
          <TeacherSummaryCards
            activeGoalsCount={reviewData.goals.length}
            activeRoadmapsCount={reviewData.roadmaps.length}
            tasksWorkedOnCount={reviewData.summary.tasksWorkedOnCount}
            tasksCompletedCount={reviewData.summary.tasksCompletedCount}
            plannedMinutes={reviewData.summary.totalPlannedMinutes}
            actualMinutes={reviewData.summary.totalActualMinutes}
            sessionCount={periodSessions.length}
            plannedCommitmentsCount={reviewData.summary.plannedCommitmentsCount}
            completedCommitmentsCount={reviewData.summary.completedCommitmentsCount}
          />

          {/* Section 2: Goals & Roadmaps Overview */}
          <TeacherGoalRoadmapSection
            goals={reviewData.goals}
            roadmaps={reviewData.roadmaps}
          />

          {/* Section 3: Task Progress Table */}
          <TeacherTaskProgressSection
            tasks={reviewData.tasks}
          />

          {/* Section 4: Weekly Planning Summary */}
          <TeacherWeeklyPlanSection
            plannedCommitmentsCount={reviewData.summary.plannedCommitmentsCount}
            completedCommitmentsCount={reviewData.summary.completedCommitmentsCount}
            totalPlannedMinutes={reviewData.summary.totalPlannedMinutes}
            datedCommitmentsCount={datedCommitmentsCount}
            flexibleCommitmentsCount={flexibleCommitmentsCount}
            activeDaysCount={activeDaysCount}
            weeklyPlanItems={weeklyPlanItems}
          />

          {/* Section 5: Recent Recorded Work (Sessions) */}
          <TeacherRecentSessionsSection
            sessions={periodSessions}
          />
        </>
      )}
    </div>
  );
};
