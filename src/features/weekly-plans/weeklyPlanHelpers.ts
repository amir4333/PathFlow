/**
 * Weekly Planning UI Helper Functions
 *
 * Provides pure utilities for ISO week navigation, target date options,
 * localized week range presentation, and aggregate summary derivations.
 * Reuses existing domain models and date formatting utilities.
 */

import {
  WeeklyPlan,
  Task,
  getWeekIdentifier,
  getWeekDateRange,
  isValidWeekIdentifier,
  calculateWeeklyPlanTotalPlannedMinutes,
  calculateWeeklyTaskCompletion,
  calculateWeeklyPlanDailyBreakdown,
  DailyPlannedBreakdownItem,
  WeeklyPlanDailyBreakdown,
} from '../../domain';
import {
  UserPreferences,
  DEFAULT_PREFERENCES,
  formatDate,
  formatNumeral,
} from '../../app/preferences';

export interface WeekDayOption {
  readonly dateIso: string; // "YYYY-MM-DD"
  readonly dayOfWeek: number; // 1 (Mon) to 7 (Sun)
}

/**
 * Returns the current ISO week identifier (e.g. "2026-W39").
 */
export function getCurrentWeekIdentifier(): string {
  return getWeekIdentifier(new Date());
}

/**
 * Returns the preceding ISO week identifier given an ISO week (e.g. "2026-W38" -> "2026-W37").
 */
export function getPreviousWeekIdentifier(weekIdentifier: string): string {
  if (!isValidWeekIdentifier(weekIdentifier)) {
    throw new Error(`Invalid week identifier: "${weekIdentifier}". Expected format YYYY-Www.`);
  }
  const { startDate } = getWeekDateRange(weekIdentifier);
  const [y, m, d] = startDate.split('T')[0].split('-').map(Number);
  const utcMonday = new Date(Date.UTC(y, m - 1, d));
  const prevMonday = new Date(utcMonday.getTime() - 7 * 24 * 3600 * 1000);
  return getWeekIdentifier(prevMonday);
}

/**
 * Returns the succeeding ISO week identifier given an ISO week (e.g. "2026-W38" -> "2026-W39").
 */
export function getNextWeekIdentifier(weekIdentifier: string): string {
  if (!isValidWeekIdentifier(weekIdentifier)) {
    throw new Error(`Invalid week identifier: "${weekIdentifier}". Expected format YYYY-Www.`);
  }
  const { startDate } = getWeekDateRange(weekIdentifier);
  const [y, m, d] = startDate.split('T')[0].split('-').map(Number);
  const utcMonday = new Date(Date.UTC(y, m - 1, d));
  const nextMonday = new Date(utcMonday.getTime() + 7 * 24 * 3600 * 1000);
  return getWeekIdentifier(nextMonday);
}

/**
 * Generates the 7 calendar days (Monday through Sunday) for the specified ISO week.
 */
export function getDaysInWeek(weekIdentifier: string): WeekDayOption[] {
  if (!isValidWeekIdentifier(weekIdentifier)) {
    return [];
  }
  const { startDate } = getWeekDateRange(weekIdentifier);
  const [y, m, d] = startDate.split('T')[0].split('-').map(Number);
  const startMonday = new Date(Date.UTC(y, m - 1, d));

  const days: WeekDayOption[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startMonday.getTime() + i * 24 * 3600 * 1000);
    const dateIso = dayDate.toISOString().split('T')[0];
    days.push({
      dateIso,
      dayOfWeek: i + 1,
    });
  }
  return days;
}

/**
 * Formats the date range of a week according to user preferences (Language and Calendar).
 * e.g., "Sep 21 – Sep 27, 2026" or "۳۰ شهریور – ۵ مهر ۱۴۰۵"
 */
export function formatWeekRange(
  weekIdentifier: string,
  preferences: UserPreferences = DEFAULT_PREFERENCES
): string {
  if (!isValidWeekIdentifier(weekIdentifier)) {
    return weekIdentifier;
  }
  try {
    const { startDate, endDate } = getWeekDateRange(weekIdentifier);
    const startFormatted = formatDate(startDate.split('T')[0], preferences, {
      month: 'short',
      day: 'numeric',
    });
    const endFormatted = formatDate(endDate.split('T')[0], preferences, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (preferences.language === 'fa') {
      return `${startFormatted} تا ${endFormatted}`;
    }
    return `${startFormatted} – ${endFormatted}`;
  } catch {
    return weekIdentifier;
  }
}

/**
 * Formats the week identifier into a localized header label.
 * e.g., "Week 38, 2026" or "هفته ۳۸، ۲۰۲۶"
 */
export function formatWeekHeading(
  weekIdentifier: string,
  preferences: UserPreferences = DEFAULT_PREFERENCES
): { main: string; raw: string } {
  if (!isValidWeekIdentifier(weekIdentifier)) {
    return { main: weekIdentifier, raw: weekIdentifier };
  }
  const match = weekIdentifier.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    return { main: weekIdentifier, raw: weekIdentifier };
  }
  const year = match[1];
  const weekNum = parseInt(match[2], 10);

  const formattedWeekNum = formatNumeral(weekNum, preferences);
  const formattedYear = formatNumeral(year, preferences);

  const main =
    preferences.language === 'fa'
      ? `هفته ${formattedWeekNum}، ${formattedYear}`
      : `Week ${weekNum}, ${year}`;

  return {
    main,
    raw: formatNumeral(weekIdentifier, preferences),
  };
}

export interface WeeklyOverviewSummary {
  readonly totalPlannedMinutes: number;
  readonly itemCount: number;
  readonly completedItemCount: number;
  readonly plannedTaskCount: number;
  readonly completedTaskCount: number;
  readonly taskCompletionPercentage: number;
}

/**
 * Derives compact summary metrics for a weekly plan using existing domain services.
 */
export function deriveWeeklyOverviewSummary(
  plan: WeeklyPlan | null,
  tasks?: readonly Task[]
): WeeklyOverviewSummary {
  if (!plan) {
    return {
      totalPlannedMinutes: 0,
      itemCount: 0,
      completedItemCount: 0,
      plannedTaskCount: 0,
      completedTaskCount: 0,
      taskCompletionPercentage: 0,
    };
  }

  const totalPlannedMinutes = calculateWeeklyPlanTotalPlannedMinutes(plan);
  const itemCount = plan.items.length;
  const completedItemCount = plan.items.filter((item) => item.isCompleted).length;
  const taskSummary = calculateWeeklyTaskCompletion(plan, tasks);

  return {
    totalPlannedMinutes,
    itemCount,
    completedItemCount,
    plannedTaskCount: taskSummary.totalPlannedTasks,
    completedTaskCount: taskSummary.completedPlannedTasks,
    taskCompletionPercentage: taskSummary.taskCompletionPercentage,
  };
}

export type DailyCapacityLevel = 'empty' | 'light' | 'moderate' | 'heavy';

/**
 * Returns simple visual capacity/load level for a given planned minute duration:
 * - empty: 0m
 * - light: 1 - 120m (<= 2h)
 * - moderate: 121 - 240m (2h - 4h)
 * - heavy: > 240m (> 4h)
 */
export function getDailyCapacityLevel(minutes: number): DailyCapacityLevel {
  if (minutes <= 0) return 'empty';
  if (minutes <= 120) return 'light';
  if (minutes <= 240) return 'moderate';
  return 'heavy';
}

/**
 * Maps an ISO dayOfWeek (1=Mon to 7=Sun) to its translation key.
 */
export function getDayNameTranslationKey(
  dayOfWeek: number
): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' {
  switch (dayOfWeek) {
    case 1:
      return 'monday';
    case 2:
      return 'tuesday';
    case 3:
      return 'wednesday';
    case 4:
      return 'thursday';
    case 5:
      return 'friday';
    case 6:
      return 'saturday';
    case 7:
      return 'sunday';
    default:
      return 'monday';
  }
}

export interface WeeklyAllocationSummary {
  readonly totalPlannedMinutes: number;
  readonly datedMinutes: number;
  readonly flexibleMinutes: number;
  readonly itemCount: number;
  readonly activeDaysCount: number;
  readonly completedItemCount: number;
  readonly taskCompletionPercentage: number;
}

/**
 * Derives weekly allocation summary: total planned time, dated time, flexible time,
 * item counts, and number of active planned days.
 */
export function deriveWeeklyAllocationSummary(
  plan: WeeklyPlan | null,
  tasks?: readonly Task[]
): WeeklyAllocationSummary {
  if (!plan) {
    return {
      totalPlannedMinutes: 0,
      datedMinutes: 0,
      flexibleMinutes: 0,
      itemCount: 0,
      activeDaysCount: 0,
      completedItemCount: 0,
      taskCompletionPercentage: 0,
    };
  }

  const breakdown = calculateWeeklyPlanDailyBreakdown(plan);
  const totalPlannedMinutes = breakdown.totalPlannedMinutes;
  const flexibleMinutes = breakdown.unallocatedMinutes;
  const datedMinutes = totalPlannedMinutes - flexibleMinutes;
  const activeDaysCount = breakdown.days.filter((d) => d.plannedMinutes > 0).length;
  const itemCount = plan.items.length;
  const completedItemCount = plan.items.filter((i) => i.isCompleted).length;
  const taskSummary = calculateWeeklyTaskCompletion(plan, tasks);

  return {
    totalPlannedMinutes,
    datedMinutes,
    flexibleMinutes,
    itemCount,
    activeDaysCount,
    completedItemCount,
    taskCompletionPercentage: taskSummary.taskCompletionPercentage,
  };
}

export type { DailyPlannedBreakdownItem, WeeklyPlanDailyBreakdown };
export { calculateWeeklyPlanDailyBreakdown };

