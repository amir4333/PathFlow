/**
 * Progress Calculation Service
 *
 * Provides pure, deterministic calculation functions to derive progress metrics
 * dynamically from source data (Tasks, Sessions, Roadmaps, Goals, and Weekly Plans).
 *
 * Avoids storing large mutable, denormalized progress records.
 */

import { EntityId } from '../common/types';
import { Goal } from '../models/goal';
import { Roadmap } from '../models/roadmap';
import { Task } from '../models/task';
import { Session } from '../models/session';
import { WeeklyPlan } from '../models/weeklyPlan';

export interface TaskProgressSummary {
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly inProgressTasks: number;
  readonly todoTasks: number;
  readonly blockedTasks: number;
  readonly cancelledTasks: number;
  readonly completionPercentage: number;
  readonly totalEstimatedMinutes: number;
  readonly completedEstimatedMinutes: number;
}

export interface SessionProgressSummary {
  readonly totalSessions: number;
  readonly totalActualMinutes: number;
  readonly averageSessionMinutes: number;
}

export interface WeeklyPlanProgressSummary {
  readonly totalPlannedItems: number;
  readonly completedPlannedItems: number;
  readonly totalPlannedMinutes: number;
  readonly totalActualMinutes: number;
  readonly itemCompletionPercentage: number;
  /** Actual session minutes minus planned minutes */
  readonly varianceMinutes: number;
}

export interface RoadmapProgressSummary {
  readonly roadmapId: EntityId;
  readonly taskSummary: TaskProgressSummary;
  readonly sessionSummary: SessionProgressSummary;
}

export interface GoalProgressSummary {
  readonly goalId: EntityId;
  readonly totalRoadmaps: number;
  readonly taskSummary: TaskProgressSummary;
  readonly sessionSummary: SessionProgressSummary;
}

/**
 * Calculates progress metrics for a list of Tasks.
 */
export function calculateTaskProgress(tasks: readonly Task[]): TaskProgressSummary {
  let completedTasks = 0;
  let inProgressTasks = 0;
  let todoTasks = 0;
  let blockedTasks = 0;
  let cancelledTasks = 0;
  let totalEstimatedMinutes = 0;
  let completedEstimatedMinutes = 0;

  for (const task of tasks) {
    totalEstimatedMinutes += task.estimatedMinutes;

    switch (task.status) {
      case 'completed':
        completedTasks++;
        completedEstimatedMinutes += task.estimatedMinutes;
        break;
      case 'in_progress':
        inProgressTasks++;
        break;
      case 'todo':
        todoTasks++;
        break;
      case 'blocked':
        blockedTasks++;
        break;
      case 'cancelled':
        cancelledTasks++;
        break;
    }
  }

  const activeOrCompletedTotal = tasks.length - cancelledTasks;
  const completionPercentage =
    activeOrCompletedTotal > 0
      ? Math.round((completedTasks / activeOrCompletedTotal) * 100)
      : 0;

  return {
    totalTasks: tasks.length,
    completedTasks,
    inProgressTasks,
    todoTasks,
    blockedTasks,
    cancelledTasks,
    completionPercentage,
    totalEstimatedMinutes,
    completedEstimatedMinutes,
  };
}

/**
 * Calculates time and volume metrics for a list of Sessions.
 */
export function calculateSessionProgress(sessions: readonly Session[]): SessionProgressSummary {
  const totalSessions = sessions.length;
  let totalActualMinutes = 0;

  for (const session of sessions) {
    totalActualMinutes += session.durationMinutes;
  }

  const averageSessionMinutes =
    totalSessions > 0 ? Math.round(totalActualMinutes / totalSessions) : 0;

  return {
    totalSessions,
    totalActualMinutes,
    averageSessionMinutes,
  };
}

/**
 * Calculates progress for a WeeklyPlan given recorded Sessions.
 */
export function calculateWeeklyPlanProgress(
  plan: WeeklyPlan,
  sessions: readonly Session[]
): WeeklyPlanProgressSummary {
  const totalPlannedItems = plan.items.length;
  let totalPlannedMinutes = 0;
  let completedPlannedItems = 0;

  const plannedTaskIds = new Set<string>();
  for (const item of plan.items) {
    totalPlannedMinutes += item.plannedMinutes;
    if (item.isCompleted) {
      completedPlannedItems++;
    }
    plannedTaskIds.add(item.taskId);
  }

  // Filter sessions that belong to the tasks planned for this week
  let totalActualMinutes = 0;
  for (const session of sessions) {
    if (plannedTaskIds.has(session.taskId)) {
      totalActualMinutes += session.durationMinutes;
    }
  }

  const itemCompletionPercentage =
    totalPlannedItems > 0
      ? Math.round((completedPlannedItems / totalPlannedItems) * 100)
      : 0;

  return {
    totalPlannedItems,
    completedPlannedItems,
    totalPlannedMinutes,
    totalActualMinutes,
    itemCompletionPercentage,
    varianceMinutes: totalActualMinutes - totalPlannedMinutes,
  };
}

/**
 * Calculates aggregated progress for a specific Roadmap.
 */
export function calculateRoadmapProgress(
  roadmapId: EntityId,
  allTasks: readonly Task[],
  allSessions: readonly Session[]
): RoadmapProgressSummary {
  const roadmapTasks = allTasks.filter((t) => t.roadmapId === roadmapId);
  const taskIds = new Set(roadmapTasks.map((t) => t.id));
  const roadmapSessions = allSessions.filter((s) => taskIds.has(s.taskId));

  return {
    roadmapId,
    taskSummary: calculateTaskProgress(roadmapTasks),
    sessionSummary: calculateSessionProgress(roadmapSessions),
  };
}

/**
 * Calculates aggregated progress for a specific Goal.
 */
export function calculateGoalProgress(
  goalId: EntityId,
  allRoadmaps: readonly Roadmap[],
  allTasks: readonly Task[],
  allSessions: readonly Session[]
): GoalProgressSummary {
  const goalRoadmaps = allRoadmaps.filter((r) => r.goalId === goalId);
  const roadmapIds = new Set(goalRoadmaps.map((r) => r.id));

  const goalTasks = allTasks.filter((t) => roadmapIds.has(t.roadmapId));
  const taskIds = new Set(goalTasks.map((t) => t.id));
  const goalSessions = allSessions.filter((s) => taskIds.has(s.taskId));

  return {
    goalId,
    totalRoadmaps: goalRoadmaps.length,
    taskSummary: calculateTaskProgress(goalTasks),
    sessionSummary: calculateSessionProgress(goalSessions),
  };
}
