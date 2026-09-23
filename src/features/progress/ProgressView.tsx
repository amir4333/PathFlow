import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import { ComprehensivePeriodReview } from '../../domain';
import { ProgressSummaryCards } from './ProgressSummaryCards';
import { PlannedVsActualBar } from './PlannedVsActualBar';
import { PlannedVsActualDailyChart } from './PlannedVsActualDailyChart';
import { ActualTimeTrendChart } from './ActualTimeTrendChart';
import { TaskCompletionTrendChart } from './TaskCompletionTrendChart';
import { RoadmapTimeDistributionChart } from './RoadmapTimeDistributionChart';
import { GoalProgressSection } from './GoalProgressSection';
import { RoadmapProgressSection } from './RoadmapProgressSection';
import { TaskActivitySection } from './TaskActivitySection';
import { DailyReviewSection } from './DailyReviewSection';

type PeriodType = 'this-week' | 'last-week' | 'custom';

export const ProgressView: React.FC = () => {
  const application = useApplication();
  const { preferences, formatDate, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgressData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await application.progress.getPeriodProgressReview({
        periodType,
        customStartDate,
        customEndDate,
      });
      setReviewData(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load progress review data.');
    } finally {
      setIsLoading(false);
    }
  }, [application.progress, periodType, customStartDate, customEndDate]);

  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  // Format localized date range string for period banner
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {t('progressTitle')}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
              <TrendingUp className="w-3 h-3 mr-1" />
              {t('reviewPeriod')}
            </span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {t('progressSubtitle')}
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-neutral-200/70 dark:bg-neutral-800 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => setPeriodType('this-week')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                periodType === 'this-week'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {t('thisWeek')}
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('last-week')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                periodType === 'last-week'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {t('lastWeek')}
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('custom')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                periodType === 'custom'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {t('customRange')}
            </button>
          </div>

          <button
            type="button"
            onClick={loadProgressData}
            title="Refresh"
            aria-label="Refresh"
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Custom Date Range Pickers (if periodType === 'custom') */}
      {periodType === 'custom' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('fromDate')}:
            </span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2.5 py-1.5 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('toDate')}:
            </span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2.5 py-1.5 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={loadProgressData}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors ml-auto"
          >
            {t('applyRange')}
          </button>
        </div>
      )}

      {/* Active Period Date Banner */}
      {reviewData && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 rounded-xl text-xs">
          <div className="flex items-center space-x-2 text-neutral-700 dark:text-neutral-300 font-medium">
            <Calendar className="w-4 h-4 text-blue-500" />
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
          <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
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
            onClick={loadProgressData}
            className="ml-auto underline hover:no-underline text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State when no data exists in period */}
      {!isLoading && !error && reviewData && reviewData.summary.totalPlannedMinutes === 0 && reviewData.summary.totalActualMinutes === 0 && (
        <div className="p-8 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
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

      {/* Main Review Dashboard Content */}
      {!isLoading && !error && reviewData && (
        <>
          {/* Section 3: Overall Progress Summary Cards */}
          <ProgressSummaryCards
            plannedMinutes={reviewData.summary.totalPlannedMinutes}
            actualMinutes={reviewData.summary.totalActualMinutes}
            varianceMinutes={reviewData.summary.varianceMinutes}
            completedTasksCount={reviewData.summary.tasksCompletedCount}
            tasksWorkedOnCount={reviewData.summary.tasksWorkedOnCount}
            plannedCommitmentsCount={reviewData.summary.plannedCommitmentsCount}
            completedCommitmentsCount={reviewData.summary.completedCommitmentsCount}
          />

          {/* Section 4: Planned vs Actual Comparison */}
          <PlannedVsActualBar
            plannedMinutes={reviewData.summary.totalPlannedMinutes}
            actualMinutes={reviewData.summary.totalActualMinutes}
          />

          {/* Phase 11B: Daily Planned vs Actual Chart */}
          <PlannedVsActualDailyChart dailyBreakdown={reviewData.dailyBreakdown} />

          {/* Phase 11B: Actual Time & Task Completion Trends (2-column on desktop) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActualTimeTrendChart dailyBreakdown={reviewData.dailyBreakdown} />
            <TaskCompletionTrendChart dailyBreakdown={reviewData.dailyBreakdown} />
          </div>

          {/* Phase 11B: Roadmap Time Distribution */}
          <RoadmapTimeDistributionChart roadmaps={reviewData.roadmaps} />

          {/* Section 8: Daily Review */}
          <DailyReviewSection dailyBreakdown={reviewData.dailyBreakdown} />

          {/* Sections 5 & 6: Goal & Roadmap Progress (2-column grid on large screens) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GoalProgressSection goals={reviewData.goals} />
            <RoadmapProgressSection roadmaps={reviewData.roadmaps} />
          </div>

          {/* Section 7: Task Activity */}
          <TaskActivitySection tasks={reviewData.tasks} />
        </>
      )}
    </div>
  );
};
