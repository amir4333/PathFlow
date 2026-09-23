/**
 * Phase 11B: Progress Visualization Data Transformation Utilities
 *
 * Pure data transformation functions that convert domain period review models
 * into clean, deterministic data structures tailored for accessible, responsive charts.
 *
 * Invariants:
 * 1. Strictly pure functions - no side-effects or DB calls.
 * 2. Neutral presentation - no arbitrary rankings, forecasting, or productivity grades.
 * 3. Exact numerical preservation - preserves full integer minute accuracy.
 * 4. Resilient to empty data sets, zero values, and missing fields.
 */

import { DailyPeriodReview, RoadmapPeriodProgress } from '../../domain';

export interface DailyComparisonItem {
  readonly date: string;
  readonly dayOfWeek: number;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly varianceMinutes: number;
  readonly hasActivity: boolean;
}

export interface PlannedVsActualChartModel {
  readonly items: readonly DailyComparisonItem[];
  readonly maxMinutes: number;
  readonly totalPlannedMinutes: number;
  readonly totalActualMinutes: number;
  readonly isEmpty: boolean;
}

export interface ActualTimeTrendPoint {
  readonly date: string;
  readonly dayOfWeek: number;
  readonly actualMinutes: number;
  readonly sessionCount: number;
}

export interface ActualTimeTrendChartModel {
  readonly points: readonly ActualTimeTrendPoint[];
  readonly maxMinutes: number;
  readonly totalActualMinutes: number;
  readonly averageMinutesPerDay: number;
  readonly isEmpty: boolean;
}

export interface TaskCompletionTrendPoint {
  readonly date: string;
  readonly dayOfWeek: number;
  readonly tasksWorkedOnCount: number;
  readonly tasksCompletedCount: number;
}

export interface TaskCompletionTrendChartModel {
  readonly points: readonly TaskCompletionTrendPoint[];
  readonly maxTasks: number;
  readonly totalTasksWorkedOn: number;
  readonly totalTasksCompleted: number;
  readonly isEmpty: boolean;
}

export interface RoadmapDistributionItem {
  readonly roadmapId: string;
  readonly title: string;
  readonly goalTitle: string;
  readonly actualMinutes: number;
  readonly plannedMinutes: number;
  readonly percentageOfTotalActual: number;
}

export interface RoadmapDistributionChartModel {
  readonly items: readonly RoadmapDistributionItem[];
  readonly totalActualMinutes: number;
  readonly isEmpty: boolean;
}

/**
 * Transforms DailyPeriodReview records into a structured Planned vs Actual daily comparison model.
 */
export function preparePlannedVsActualDailyData(
  dailyBreakdown: readonly DailyPeriodReview[]
): PlannedVsActualChartModel {
  let totalPlannedMinutes = 0;
  let totalActualMinutes = 0;
  let maxMinutes = 0;

  const items: DailyComparisonItem[] = dailyBreakdown.map((day) => {
    const planned = Math.max(0, day.plannedMinutes || 0);
    const actual = Math.max(0, day.actualMinutes || 0);
    totalPlannedMinutes += planned;
    totalActualMinutes += actual;

    if (planned > maxMinutes) maxMinutes = planned;
    if (actual > maxMinutes) maxMinutes = actual;

    return {
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      plannedMinutes: planned,
      actualMinutes: actual,
      varianceMinutes: actual - planned,
      hasActivity: planned > 0 || actual > 0,
    };
  });

  const isEmpty = totalPlannedMinutes === 0 && totalActualMinutes === 0;

  return {
    items,
    maxMinutes: maxMinutes > 0 ? maxMinutes : 60,
    totalPlannedMinutes,
    totalActualMinutes,
    isEmpty,
  };
}

/**
 * Transforms DailyPeriodReview records into an Actual Time trend model.
 */
export function prepareActualTimeTrendData(
  dailyBreakdown: readonly DailyPeriodReview[]
): ActualTimeTrendChartModel {
  let totalActualMinutes = 0;
  let maxMinutes = 0;

  const points: ActualTimeTrendPoint[] = dailyBreakdown.map((day) => {
    const actual = Math.max(0, day.actualMinutes || 0);
    totalActualMinutes += actual;
    if (actual > maxMinutes) maxMinutes = actual;

    return {
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      actualMinutes: actual,
      sessionCount: Math.max(0, day.sessionCount || 0),
    };
  });

  const count = points.length || 1;
  const averageMinutesPerDay = Math.round(totalActualMinutes / count);
  const isEmpty = totalActualMinutes === 0;

  return {
    points,
    maxMinutes: maxMinutes > 0 ? maxMinutes : 60,
    totalActualMinutes,
    averageMinutesPerDay,
    isEmpty,
  };
}

/**
 * Transforms DailyPeriodReview records into a Task Completion trend model.
 */
export function prepareTaskCompletionTrendData(
  dailyBreakdown: readonly DailyPeriodReview[]
): TaskCompletionTrendChartModel {
  let maxTasks = 0;
  let totalTasksWorkedOn = 0;
  let totalTasksCompleted = 0;

  const points: TaskCompletionTrendPoint[] = dailyBreakdown.map((day) => {
    const workedOn = Math.max(0, day.tasksWorkedOnCount || 0);
    const completed = Math.max(0, day.tasksCompletedCount || 0);

    totalTasksWorkedOn += workedOn;
    totalTasksCompleted += completed;

    if (workedOn > maxTasks) maxTasks = workedOn;
    if (completed > maxTasks) maxTasks = completed;

    return {
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      tasksWorkedOnCount: workedOn,
      tasksCompletedCount: completed,
    };
  });

  const isEmpty = totalTasksWorkedOn === 0 && totalTasksCompleted === 0;

  return {
    points,
    maxTasks: maxTasks > 0 ? maxTasks : 4,
    totalTasksWorkedOn,
    totalTasksCompleted,
    isEmpty,
  };
}

/**
 * Transforms RoadmapPeriodProgress records into a Roadmap Time Distribution model.
 * Preserves exact actual minutes and calculates proportional distribution.
 */
export function prepareRoadmapDistributionData(
  roadmaps: readonly RoadmapPeriodProgress[]
): RoadmapDistributionChartModel {
  // Filter to roadmaps that have logged actual time in the period
  const activeWithActual = roadmaps.filter((r) => (r.actualMinutes || 0) > 0);
  const totalActualMinutes = activeWithActual.reduce(
    (sum, r) => sum + Math.max(0, r.actualMinutes || 0),
    0
  );

  if (totalActualMinutes === 0 || activeWithActual.length === 0) {
    return {
      items: [],
      totalActualMinutes: 0,
      isEmpty: true,
    };
  }

  const items: RoadmapDistributionItem[] = activeWithActual.map((r) => {
    const actual = Math.max(0, r.actualMinutes || 0);
    const percentageOfTotalActual =
      totalActualMinutes > 0 ? Math.round((actual / totalActualMinutes) * 100) : 0;

    return {
      roadmapId: r.roadmapId,
      title: r.title?.trim() || 'General',
      goalTitle: r.goalTitle?.trim() || 'General',
      actualMinutes: actual,
      plannedMinutes: Math.max(0, r.plannedMinutes || 0),
      percentageOfTotalActual,
    };
  });

  // Sort descending by actual minutes for clean visual hierarchy without subjective ranking
  items.sort((a, b) => b.actualMinutes - a.actualMinutes);

  return {
    items,
    totalActualMinutes,
    isEmpty: false,
  };
}
