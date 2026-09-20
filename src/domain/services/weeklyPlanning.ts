/**
 * Weekly Planning Domain Service
 *
 * Provides pure, deterministic calculation functions for the Weekly Planning system:
 * - Planned minutes aggregation (Task, Roadmap, Goal, Plan)
 * - Daily planned allocation breakdowns and date-specific planned queries
 * - Task completion vs. Time completion separation
 * - Planned vs. Actual integration and Weekly Progress Summaries
 *
 * Pure TypeScript - Zero dependencies on React, browser DOM, or storage implementations.
 */

import {
  EntityId,
  getWeekIdentifier,
  getWeekDateRange,
  isValidTimestamp,
} from '../common/types';
import { Task } from '../models/task';
import { Roadmap } from '../models/roadmap';
import { Goal } from '../models/goal';
import { Session } from '../models/session';
import { WeeklyPlan, WeeklyPlanItem } from '../models/weeklyPlan';

/**
 * Filter out invalid or negative session records so calculations remain resilient.
 */
function isValidSessionRecord(session: Session): boolean {
  return (
    typeof session.durationMinutes === 'number' &&
    !isNaN(session.durationMinutes) &&
    session.durationMinutes >= 0 &&
    isValidTimestamp(session.startedAt) &&
    isValidTimestamp(session.endedAt)
  );
}

/**
 * Calculates total planned minutes for a specific Task in a WeeklyPlan.
 * Sums all daily allocations and weekly commitments for this task.
 */
export function calculateTaskPlannedMinutesInPlan(
  taskId: EntityId,
  plan: WeeklyPlan
): number {
  return plan.items
    .filter((item) => item.taskId === taskId)
    .reduce((sum, item) => sum + item.plannedMinutes, 0);
}

/**
 * Calculates total planned minutes for all Tasks belonging to a Roadmap in a WeeklyPlan.
 */
export function calculateRoadmapPlannedMinutesInPlan(
  roadmapId: EntityId,
  tasks: readonly Task[],
  plan: WeeklyPlan
): number {
  const taskIds = new Set(tasks.filter((t) => t.roadmapId === roadmapId).map((t) => t.id));
  return plan.items
    .filter((item) => taskIds.has(item.taskId))
    .reduce((sum, item) => sum + item.plannedMinutes, 0);
}

/**
 * Calculates total planned minutes for all Roadmaps and Tasks belonging to a Goal in a WeeklyPlan.
 */
export function calculateGoalPlannedMinutesInPlan(
  goalId: EntityId,
  roadmaps: readonly Roadmap[],
  tasks: readonly Task[],
  plan: WeeklyPlan
): number {
  const roadmapIds = new Set(roadmaps.filter((r) => r.goalId === goalId).map((r) => r.id));
  const taskIds = new Set(tasks.filter((t) => roadmapIds.has(t.roadmapId)).map((t) => t.id));
  return plan.items
    .filter((item) => taskIds.has(item.taskId))
    .reduce((sum, item) => sum + item.plannedMinutes, 0);
}

/**
 * Calculates total planned minutes across all items in a WeeklyPlan.
 */
export function calculateWeeklyPlanTotalPlannedMinutes(plan: WeeklyPlan): number {
  return plan.items.reduce((sum, item) => sum + item.plannedMinutes, 0);
}

/**
 * Calculates total planned minutes allocated to a specific calendar date (YYYY-MM-DD).
 */
export function calculateDatePlannedMinutes(
  date: string,
  plan: WeeklyPlan
): number {
  const cleanDate = date.trim().split('T')[0];
  return plan.items
    .filter((item) => item.targetDate === cleanDate)
    .reduce((sum, item) => sum + item.plannedMinutes, 0);
}

/**
 * Single day entry in a weekly plan daily breakdown.
 */
export interface DailyPlannedBreakdownItem {
  /** Calendar date string: YYYY-MM-DD */
  readonly date: string;
  /** ISO day of week: 1 (Monday) to 7 (Sunday) */
  readonly dayOfWeek: number;
  /** Planned minutes assigned to this specific date */
  readonly plannedMinutes: number;
  /** Planned items scheduled for this date */
  readonly items: readonly WeeklyPlanItem[];
}

/**
 * Comprehensive weekly breakdown grouping daily allocations by day (Mon-Sun)
 * alongside flexible unallocated weekly commitments.
 */
export interface WeeklyPlanDailyBreakdown {
  readonly weekIdentifier: string;
  readonly days: readonly DailyPlannedBreakdownItem[];
  /** Planned minutes not tied to a specific calendar day */
  readonly unallocatedMinutes: number;
  readonly unallocatedItems: readonly WeeklyPlanItem[];
  readonly totalPlannedMinutes: number;
}

/**
 * Calculates the complete day-by-day planned breakdown for a WeeklyPlan.
 * Generates entries for all 7 days of the ISO week (Monday through Sunday)
 * and isolates unallocated flexible weekly items.
 */
export function calculateWeeklyPlanDailyBreakdown(
  plan: WeeklyPlan
): WeeklyPlanDailyBreakdown {
  const { startDate } = getWeekDateRange(plan.weekIdentifier);
  const startMonday = new Date(startDate);

  // Build the 7 days (Monday = 1, Sunday = 7)
  const days: DailyPlannedBreakdownItem[] = [];
  const itemsByDate = new Map<string, WeeklyPlanItem[]>();
  const unallocatedItems: WeeklyPlanItem[] = [];

  for (const item of plan.items) {
    if (item.targetDate && item.targetDate.trim().length > 0) {
      const clean = item.targetDate.trim();
      const existing = itemsByDate.get(clean) ?? [];
      existing.push(item);
      itemsByDate.set(clean, existing);
    } else {
      unallocatedItems.push(item);
    }
  }

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startMonday.getTime() + i * 24 * 3600 * 1000);
    const dateStr = dayDate.toISOString().split('T')[0];
    const dayItems = itemsByDate.get(dateStr) ?? [];
    const dayPlannedMinutes = dayItems.reduce((sum, item) => sum + item.plannedMinutes, 0);

    days.push({
      date: dateStr,
      dayOfWeek: i + 1,
      plannedMinutes: dayPlannedMinutes,
      items: dayItems,
    });
  }

  const unallocatedMinutes = unallocatedItems.reduce((sum, item) => sum + item.plannedMinutes, 0);
  const totalPlannedMinutes = calculateWeeklyPlanTotalPlannedMinutes(plan);

  return {
    weekIdentifier: plan.weekIdentifier,
    days,
    unallocatedMinutes,
    unallocatedItems,
    totalPlannedMinutes,
  };
}

/**
 * Summary of Task completion metrics within a WeeklyPlan.
 * Completely distinct from Time completion metrics.
 */
export interface WeeklyTaskCompletionSummary {
  readonly totalPlannedTasks: number;
  readonly completedPlannedTasks: number;
  readonly remainingPlannedTasks: number;
  readonly taskCompletionPercentage: number;
}

/**
 * Calculates task completion metrics for planned tasks in a WeeklyPlan.
 *
 * If `tasks` is supplied, checks actual `task.status === 'completed'`.
 * Otherwise, inspects whether all items for that task in the plan are marked `isCompleted`.
 */
export function calculateWeeklyTaskCompletion(
  plan: WeeklyPlan,
  tasks?: readonly Task[]
): WeeklyTaskCompletionSummary {
  const distinctTaskIds = Array.from(new Set(plan.items.map((item) => item.taskId)));
  const totalPlannedTasks = distinctTaskIds.length;

  if (totalPlannedTasks === 0) {
    return {
      totalPlannedTasks: 0,
      completedPlannedTasks: 0,
      remainingPlannedTasks: 0,
      taskCompletionPercentage: 0,
    };
  }

  const taskMap = tasks ? new Map(tasks.map((t) => [t.id, t])) : null;
  let completedPlannedTasks = 0;

  for (const taskId of distinctTaskIds) {
    if (taskMap) {
      const task = taskMap.get(taskId);
      if (task && task.status === 'completed') {
        completedPlannedTasks++;
        continue;
      }
    }

    // Fallback: check if all items for this task in the plan are marked completed
    const taskItems = plan.items.filter((item) => item.taskId === taskId);
    if (taskItems.length > 0 && taskItems.every((item) => item.isCompleted)) {
      completedPlannedTasks++;
    }
  }

  const remainingPlannedTasks = totalPlannedTasks - completedPlannedTasks;
  const taskCompletionPercentage = Math.round((completedPlannedTasks / totalPlannedTasks) * 100);

  return {
    totalPlannedTasks,
    completedPlannedTasks,
    remainingPlannedTasks,
    taskCompletionPercentage,
  };
}

/**
 * Derives actual session minutes recorded for planned tasks within the plan's ISO week.
 * Sessions outside the plan's week or belonging to non-planned tasks are excluded.
 */
export function calculateWeeklyPlanActualMinutesInWeek(
  plan: WeeklyPlan,
  sessions: readonly Session[]
): number {
  const plannedTaskIds = new Set(plan.items.map((item) => item.taskId));
  const targetWeek = plan.weekIdentifier.trim();

  return sessions
    .filter((s) => {
      if (!isValidSessionRecord(s)) return false;
      if (!plannedTaskIds.has(s.taskId)) return false;
      try {
        return getWeekIdentifier(s.startedAt) === targetWeek;
      } catch {
        return false;
      }
    })
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

/**
 * Detailed Task-level planned vs actual comparison for a specific week.
 */
export interface WeeklyTaskProgressSummary {
  readonly taskId: EntityId;
  readonly taskTitle?: string;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  /** actualMinutes - plannedMinutes */
  readonly varianceMinutes: number;
  readonly isCompleted: boolean;
  /** Percentage of planned time completed (0-100+) */
  readonly percentage: number;
}

/**
 * Pure domain-level weekly progress summary.
 * Answers: "What did I plan to work on this week, and how much did I accomplish?"
 * Clear separation between planned commitments and actual activity.
 */
export interface WeeklyProgressSummary {
  readonly weekIdentifier: string;
  /** Total planned minutes across all items */
  readonly plannedMinutes: number;
  /** Overall target capacity for the week (defaults to plannedMinutes if 0) */
  readonly targetMinutes: number;
  /** Actual recorded minutes on planned tasks during this week */
  readonly actualMinutes: number;
  /** actualMinutes - plannedMinutes (positive = overtime, negative = under planned) */
  readonly varianceMinutes: number;
  /** Remaining minutes under planned: Math.max(0, plannedMinutes - actualMinutes) */
  readonly remainingMinutes: number;
  readonly plannedTaskCount: number;
  readonly completedTaskCount: number;
  readonly remainingTaskCount: number;
  readonly taskCompletionPercentage: number;
  readonly timeCompletionPercentage: number;
  readonly taskSummaries: readonly WeeklyTaskProgressSummary[];
}

/**
 * Produces a comprehensive WeeklyProgressSummary contrasting intended plans vs. actual historical sessions.
 */
export function calculateWeeklyProgressSummary(
  plan: WeeklyPlan,
  sessions: readonly Session[],
  tasks?: readonly Task[]
): WeeklyProgressSummary {
  const targetWeek = plan.weekIdentifier.trim();
  const taskMap = tasks ? new Map(tasks.map((t) => [t.id, t])) : null;

  // Filter sessions that took place in this week
  const weekSessions = sessions.filter((s) => {
    if (!isValidSessionRecord(s)) return false;
    try {
      return getWeekIdentifier(s.startedAt) === targetWeek;
    } catch {
      return false;
    }
  });

  const distinctTaskIds = Array.from(new Set(plan.items.map((item) => item.taskId)));
  const taskSummaries: WeeklyTaskProgressSummary[] = [];

  let totalActualMinutes = 0;

  for (const taskId of distinctTaskIds) {
    const plannedForTask = calculateTaskPlannedMinutesInPlan(taskId, plan);
    const taskSessions = weekSessions.filter((s) => s.taskId === taskId);
    const actualForTask = taskSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    totalActualMinutes += actualForTask;

    let isCompleted = false;
    let taskTitle: string | undefined;

    if (taskMap) {
      const task = taskMap.get(taskId);
      if (task) {
        taskTitle = task.title;
        isCompleted = task.status === 'completed';
      }
    }

    if (!isCompleted) {
      const taskItems = plan.items.filter((item) => item.taskId === taskId);
      isCompleted = taskItems.length > 0 && taskItems.every((item) => item.isCompleted);
    }

    const variance = actualForTask - plannedForTask;
    const percentage = plannedForTask > 0 ? Math.round((actualForTask / plannedForTask) * 100) : 0;

    taskSummaries.push({
      taskId,
      taskTitle,
      plannedMinutes: plannedForTask,
      actualMinutes: actualForTask,
      varianceMinutes: variance,
      isCompleted,
      percentage,
    });
  }

  const plannedMinutes = calculateWeeklyPlanTotalPlannedMinutes(plan);
  const targetMinutes = plan.targetMinutes > 0 ? plan.targetMinutes : plannedMinutes;
  const varianceMinutes = totalActualMinutes - plannedMinutes;
  const remainingMinutes = Math.max(0, plannedMinutes - totalActualMinutes);

  const taskCompletion = calculateWeeklyTaskCompletion(plan, tasks);
  const timeCompletionPercentage =
    plannedMinutes > 0 ? Math.round((totalActualMinutes / plannedMinutes) * 100) : 0;

  return {
    weekIdentifier: plan.weekIdentifier,
    plannedMinutes,
    targetMinutes,
    actualMinutes: totalActualMinutes,
    varianceMinutes,
    remainingMinutes,
    plannedTaskCount: taskCompletion.totalPlannedTasks,
    completedTaskCount: taskCompletion.completedPlannedTasks,
    remainingTaskCount: taskCompletion.remainingPlannedTasks,
    taskCompletionPercentage: taskCompletion.taskCompletionPercentage,
    timeCompletionPercentage,
    taskSummaries,
  };
}
