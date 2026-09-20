/**
 * Time Tracking and Aggregation Domain Service
 *
 * Provides pure, deterministic calculation functions to derive actual recorded work time
 * and planned vs. actual comparisons across all levels of the PathFlow domain hierarchy:
 * Task, Roadmap, Goal, Weekly Plan, specific Date, and ISO Week.
 *
 * Pure TypeScript - Zero dependencies on UI, browser DOM, or storage layers.
 */

import { EntityId, getWeekIdentifier, isValidTimestamp } from '../common/types';
import { Task } from '../models/task';
import { Roadmap } from '../models/roadmap';
import { Goal } from '../models/goal';
import { Session } from '../models/session';
import { WeeklyPlan } from '../models/weeklyPlan';

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
 * Derives total actual recorded minutes for a specific Task.
 */
export function calculateTaskActualMinutes(
  taskId: EntityId,
  sessions: readonly Session[]
): number {
  return sessions
    .filter((s) => s.taskId === taskId && isValidSessionRecord(s))
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

/**
 * Derives total actual recorded minutes for all Tasks belonging to a Roadmap.
 */
export function calculateRoadmapActualMinutes(
  roadmapId: EntityId,
  tasks: readonly Task[],
  sessions: readonly Session[]
): number {
  const taskIds = new Set(tasks.filter((t) => t.roadmapId === roadmapId).map((t) => t.id));
  return sessions
    .filter((s) => taskIds.has(s.taskId) && isValidSessionRecord(s))
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

/**
 * Derives total actual recorded minutes for all Roadmaps and Tasks belonging to a Goal.
 */
export function calculateGoalActualMinutes(
  goalId: EntityId,
  roadmaps: readonly Roadmap[],
  tasks: readonly Task[],
  sessions: readonly Session[]
): number {
  const roadmapIds = new Set(roadmaps.filter((r) => r.goalId === goalId).map((r) => r.id));
  const taskIds = new Set(tasks.filter((t) => roadmapIds.has(t.roadmapId)).map((t) => t.id));
  return sessions
    .filter((s) => taskIds.has(s.taskId) && isValidSessionRecord(s))
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

/**
 * Derives total actual recorded minutes for the Tasks planned in a WeeklyPlan.
 */
export function calculateWeeklyPlanActualMinutes(
  plan: WeeklyPlan,
  sessions: readonly Session[]
): number {
  const plannedTaskIds = new Set(plan.items.map((item) => item.taskId));
  return sessions
    .filter((s) => plannedTaskIds.has(s.taskId) && isValidSessionRecord(s))
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

/**
 * Derives total actual recorded minutes across all sessions started on a specific calendar date (YYYY-MM-DD).
 */
export function calculateDateActualMinutes(
  date: string,
  sessions: readonly Session[]
): number {
  const cleanDate = date.trim().split('T')[0];
  return sessions
    .filter((s) => isValidSessionRecord(s) && s.startedAt.startsWith(cleanDate))
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

/**
 * Derives total actual recorded minutes across all sessions started within a specific ISO week (YYYY-Www).
 */
export function calculateWeekActualMinutes(
  weekIdentifier: string,
  sessions: readonly Session[]
): number {
  const targetWeek = weekIdentifier.trim();
  return sessions
    .filter((s) => {
      if (!isValidSessionRecord(s)) return false;
      try {
        return getWeekIdentifier(s.startedAt) === targetWeek;
      } catch {
        return false;
      }
    })
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

/**
 * Deterministic comparison structure contrasting planned/estimated time vs. actual work performed.
 */
export interface PlannedVsActualComparison {
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  /**
   * Variance between actual and planned minutes.
   * Positive = exceeded / overtime.
   * Negative = remaining under budget.
   */
  readonly varianceMinutes: number;
  /**
   * Percentage of planned time consumed (0-100+).
   * Returns 0 if plannedMinutes is 0.
   */
  readonly percentage: number;
}

/**
 * Helper to build a PlannedVsActualComparison cleanly.
 */
function createComparison(plannedMinutes: number, actualMinutes: number): PlannedVsActualComparison {
  const variance = actualMinutes - plannedMinutes;
  const percentage =
    plannedMinutes > 0 ? Math.round((actualMinutes / plannedMinutes) * 100) : 0;

  return {
    plannedMinutes,
    actualMinutes,
    varianceMinutes: variance,
    percentage,
  };
}

/**
 * Compares estimated vs actual time for a Task.
 */
export function compareTaskPlannedVsActual(
  task: Task,
  sessions: readonly Session[]
): PlannedVsActualComparison {
  const actual = calculateTaskActualMinutes(task.id, sessions);
  return createComparison(task.estimatedMinutes, actual);
}

/**
 * Compares target/planned vs actual time for a WeeklyPlan.
 */
export function compareWeeklyPlanPlannedVsActual(
  plan: WeeklyPlan,
  sessions: readonly Session[]
): PlannedVsActualComparison {
  // Use targetMinutes if defined, or sum item plannedMinutes
  const planned =
    plan.targetMinutes > 0
      ? plan.targetMinutes
      : plan.items.reduce((sum, item) => sum + item.plannedMinutes, 0);

  const actual = calculateWeeklyPlanActualMinutes(plan, sessions);
  return createComparison(planned, actual);
}

/**
 * Compares total estimated time across Roadmap tasks vs actual session time.
 */
export function compareRoadmapPlannedVsActual(
  roadmapId: EntityId,
  tasks: readonly Task[],
  sessions: readonly Session[]
): PlannedVsActualComparison {
  const roadmapTasks = tasks.filter((t) => t.roadmapId === roadmapId);
  const planned = roadmapTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const actual = calculateRoadmapActualMinutes(roadmapId, tasks, sessions);
  return createComparison(planned, actual);
}

/**
 * Compares total estimated time across Goal tasks vs actual session time.
 */
export function compareGoalPlannedVsActual(
  goalId: EntityId,
  roadmaps: readonly Roadmap[],
  tasks: readonly Task[],
  sessions: readonly Session[]
): PlannedVsActualComparison {
  const roadmapIds = new Set(roadmaps.filter((r) => r.goalId === goalId).map((r) => r.id));
  const goalTasks = tasks.filter((t) => roadmapIds.has(t.roadmapId));
  const planned = goalTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const actual = calculateGoalActualMinutes(goalId, roadmaps, tasks, sessions);
  return createComparison(planned, actual);
}

/**
 * Task-level aggregated activity for a specific day.
 */
export interface TaskDailyActivitySummary {
  readonly taskId: EntityId;
  readonly totalActualMinutes: number;
  readonly sessionCount: number;
}

/**
 * Daily activity snapshot representing the user's historical execution on a given calendar day.
 */
export interface DailyActivitySummary {
  readonly date: string; // YYYY-MM-DD
  readonly totalActualMinutes: number;
  readonly sessionCount: number;
  readonly taskActivities: readonly TaskDailyActivitySummary[];
}

/**
 * Transforms a list of historical sessions into chronological daily activity summaries.
 * Grouped by calendar day and aggregated per task.
 */
export function calculateDailyActivitySummaries(
  sessions: readonly Session[]
): DailyActivitySummary[] {
  const daysMap = new Map<
    string,
    { totalMinutes: number; sessionCount: number; taskMap: Map<string, { minutes: number; count: number }> }
  >();

  for (const session of sessions) {
    if (!isValidSessionRecord(session)) continue;
    const date = session.startedAt.split('T')[0];

    let dayData = daysMap.get(date);
    if (!dayData) {
      dayData = { totalMinutes: 0, sessionCount: 0, taskMap: new Map() };
      daysMap.set(date, dayData);
    }

    dayData.totalMinutes += session.durationMinutes;
    dayData.sessionCount += 1;

    let taskData = dayData.taskMap.get(session.taskId);
    if (!taskData) {
      taskData = { minutes: 0, count: 0 };
      dayData.taskMap.set(session.taskId, taskData);
    }
    taskData.minutes += session.durationMinutes;
    taskData.count += 1;
  }

  // Sort dates chronologically
  const sortedDates = Array.from(daysMap.keys()).sort();

  return sortedDates.map((date) => {
    const data = daysMap.get(date)!;
    const taskActivities: TaskDailyActivitySummary[] = Array.from(data.taskMap.entries()).map(
      ([taskId, stats]) => ({
        taskId,
        totalActualMinutes: stats.minutes,
        sessionCount: stats.count,
      })
    );

    return {
      date,
      totalActualMinutes: data.totalMinutes,
      sessionCount: data.sessionCount,
      taskActivities,
    };
  });
}
