/**
 * Progress & Review Domain Service (Phase 6)
 *
 * Provides pure, deterministic calculation functions to derive comprehensive historical
 * progress, review summaries, multi-level hierarchy evaluations, and time series trends.
 *
 * Core Principles:
 * 1. Progress is purely derived on-demand from primary domain entities (Goal, Roadmap, Task, Session, WeeklyPlan).
 * 2. Unified domain model: identical calculations across Academic Learning and Game Systems Lab.
 * 3. Historical data preservation: non-destructive, reproducible calculations.
 * 4. Transparent metrics: task completion vs. time completion, clear planned vs. actual variance.
 * 5. Zero dependencies on UI, browser DOM, Dexie, or storage layers.
 */

import {
  EntityId,
  Timestamp,
  createTimestamp,
  getWeekIdentifier,
  isValidDateString,
  isValidTimestamp,
} from '../common/types';
import {
  DateRange,
  isDateWithinRange,
  getDatesInRange,
  getTodayPeriod,
  getWeekPeriod,
  getLastNDaysPeriod,
} from '../common/dateRange';
import { Goal } from '../models/goal';
import { Roadmap } from '../models/roadmap';
import { Task, TaskStatus } from '../models/task';
import { Session } from '../models/session';
import { WeeklyPlan } from '../models/weeklyPlan';
import {
  PlannedVsActualComparison,
  calculateTaskActualMinutes,
  calculateRoadmapActualMinutes,
  calculateGoalActualMinutes,
} from './timeTracking';
import { calculateDatePlannedMinutes } from './weeklyPlanning';

// =============================================================================
// Helper Invariants & Utility Guards
// =============================================================================

export function isValidSession(s: Session): boolean {
  return (
    typeof s.durationMinutes === 'number' &&
    !isNaN(s.durationMinutes) &&
    s.durationMinutes >= 0 &&
    isValidTimestamp(s.startedAt) &&
    isValidTimestamp(s.endedAt)
  );
}

/**
 * Pure calculation of Planned vs. Actual comparison safely guarding against divide-by-zero.
 */
export function calculatePlannedVsActual(
  plannedMinutes: number,
  actualMinutes: number
): PlannedVsActualComparison {
  const safePlanned = Math.max(0, isNaN(plannedMinutes) ? 0 : plannedMinutes);
  const safeActual = Math.max(0, isNaN(actualMinutes) ? 0 : actualMinutes);
  const varianceMinutes = safeActual - safePlanned;
  const percentage =
    safePlanned > 0 ? Math.round((safeActual / safePlanned) * 100) : 0;

  return {
    plannedMinutes: safePlanned,
    actualMinutes: safeActual,
    varianceMinutes,
    percentage,
  };
}

// =============================================================================
// A. Daily Progress Summary
// =============================================================================

export interface DailyTaskActivityDetail {
  readonly taskId: EntityId;
  readonly taskTitle?: string;
  readonly roadmapId?: EntityId;
  readonly status?: TaskStatus;
  readonly isCompleted: boolean;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly sessionCount: number;
  readonly varianceMinutes: number;
}

export interface DailyProgressSummary {
  readonly date: string; // YYYY-MM-DD
  readonly totalActualMinutes: number;
  readonly sessionCount: number;
  readonly plannedMinutes: number;
  readonly plannedVsActual: PlannedVsActualComparison;
  readonly workedOnTaskCount: number;
  readonly completedTaskCount: number;
  readonly taskCompletionPercentage: number;
  readonly timeCompletionPercentage: number;
  readonly tasksWorkedOn: readonly DailyTaskActivityDetail[];
  readonly tasksCompleted: readonly DailyTaskActivityDetail[];
}

/**
 * Calculates a structured DailyProgressSummary for a specific calendar date (YYYY-MM-DD).
 */
export function calculateDailyProgressSummary(
  date: string,
  sessions: readonly Session[],
  tasks: readonly Task[],
  weeklyPlans?: readonly WeeklyPlan[]
): DailyProgressSummary {
  const cleanDate = date.trim().split('T')[0];
  if (!isValidDateString(cleanDate)) {
    throw new Error(`Invalid calendar date provided to calculateDailyProgressSummary: "${date}"`);
  }

  // Filter sessions strictly belonging to this date
  const daySessions = sessions.filter(
    (s) => isValidSession(s) && s.startedAt.startsWith(cleanDate)
  );

  const totalActualMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const sessionCount = daySessions.length;

  // Task map for metadata lookup
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Calculate planned minutes for this date if weekly plans exist
  let plannedMinutes = 0;
  const taskPlannedForDay = new Map<string, number>();

  if (weeklyPlans) {
    for (const plan of weeklyPlans) {
      for (const item of plan.items) {
        if (item.targetDate === cleanDate) {
          plannedMinutes += item.plannedMinutes;
          const current = taskPlannedForDay.get(item.taskId) ?? 0;
          taskPlannedForDay.set(item.taskId, current + item.plannedMinutes);
        }
      }
    }
  }

  // Group actual session activity by task
  const taskSessionsMap = new Map<string, { minutes: number; count: number }>();
  for (const session of daySessions) {
    const existing = taskSessionsMap.get(session.taskId) ?? { minutes: 0, count: 0 };
    taskSessionsMap.set(session.taskId, {
      minutes: existing.minutes + session.durationMinutes,
      count: existing.count + 1,
    });
  }

  // Compile all tasks that were either worked on or planned for this day
  const relevantTaskIds = new Set<string>([
    ...taskSessionsMap.keys(),
    ...taskPlannedForDay.keys(),
  ]);

  const tasksWorkedOn: DailyTaskActivityDetail[] = [];
  const tasksCompleted: DailyTaskActivityDetail[] = [];

  for (const taskId of relevantTaskIds) {
    const task = taskMap.get(taskId);
    const sessionData = taskSessionsMap.get(taskId) ?? { minutes: 0, count: 0 };
    const taskPlanned = taskPlannedForDay.get(taskId) ?? 0;
    const isCompleted = task ? task.status === 'completed' : false;

    const detail: DailyTaskActivityDetail = {
      taskId,
      taskTitle: task?.title,
      roadmapId: task?.roadmapId,
      status: task?.status,
      isCompleted,
      plannedMinutes: taskPlanned,
      actualMinutes: sessionData.minutes,
      sessionCount: sessionData.count,
      varianceMinutes: sessionData.minutes - taskPlanned,
    };

    if (sessionData.count > 0) {
      tasksWorkedOn.push(detail);
    }
    if (isCompleted && (sessionData.count > 0 || taskPlanned > 0)) {
      tasksCompleted.push(detail);
    }
  }

  // Sort tasksWorkedOn by actual time descending
  tasksWorkedOn.sort((a, b) => b.actualMinutes - a.actualMinutes);

  const plannedVsActual = calculatePlannedVsActual(plannedMinutes, totalActualMinutes);

  // Task completion percentage
  let taskCompletionPercentage = 0;
  if (taskPlannedForDay.size > 0) {
    const plannedTaskIds = Array.from(taskPlannedForDay.keys());
    const completedCount = plannedTaskIds.filter((id) => taskMap.get(id)?.status === 'completed').length;
    taskCompletionPercentage = Math.round((completedCount / plannedTaskIds.length) * 100);
  } else if (tasksWorkedOn.length > 0) {
    const completedWorkedOn = tasksWorkedOn.filter((t) => t.isCompleted).length;
    taskCompletionPercentage = Math.round((completedWorkedOn / tasksWorkedOn.length) * 100);
  }

  return {
    date: cleanDate,
    totalActualMinutes,
    sessionCount,
    plannedMinutes,
    plannedVsActual,
    workedOnTaskCount: tasksWorkedOn.length,
    completedTaskCount: tasksCompleted.length,
    taskCompletionPercentage,
    timeCompletionPercentage: plannedVsActual.percentage,
    tasksWorkedOn,
    tasksCompleted,
  };
}

// =============================================================================
// B. Weekly Progress Review (Historical & Current Weeks)
// =============================================================================

export interface RoadmapReviewProgress {
  readonly roadmapId: EntityId;
  readonly roadmapTitle: string;
  readonly goalId: EntityId;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly taskCompletionPercentage: number;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly varianceMinutes: number;
  readonly sessionCount: number;
}

export interface GoalReviewProgress {
  readonly goalId: EntityId;
  readonly goalTitle: string;
  readonly totalRoadmaps: number;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly taskCompletionPercentage: number;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly varianceMinutes: number;
  readonly sessionCount: number;
}

export interface WeeklyReviewSummary {
  readonly weekIdentifier: string;
  readonly dateRange: DateRange;
  readonly plannedMinutes: number;
  readonly targetMinutes: number;
  readonly actualMinutes: number;
  readonly sessionCount: number;
  readonly tasksWorkedOnCount: number;
  readonly tasksCompletedCount: number;
  readonly taskCompletionPercentage: number;
  readonly timeCompletionPercentage: number;
  readonly plannedVsActual: PlannedVsActualComparison;
  readonly hasWeeklyPlan: boolean;
  readonly tasksWorkedOn: readonly DailyTaskActivityDetail[];
  readonly roadmapProgress: readonly RoadmapReviewProgress[];
  readonly goalProgress: readonly GoalReviewProgress[];
}

/**
 * Generates a historical WeeklyReviewSummary for any ISO week (e.g. "2026-W38").
 * Deterministically aggregates sessions, planned commitments (if a plan exists),
 * and computes roadmap- and goal-level contributions.
 */
export function calculateWeeklyReviewSummary(
  weekIdentifier: string,
  sessions: readonly Session[],
  tasks: readonly Task[],
  roadmaps: readonly Roadmap[],
  goals: readonly Goal[],
  weeklyPlan?: WeeklyPlan | null
): WeeklyReviewSummary {
  const targetWeek = weekIdentifier.trim();
  const dateRange = getWeekPeriod(targetWeek);

  // Filter sessions that took place in this week
  const weekSessions = sessions.filter((s) => {
    if (!isValidSession(s)) return false;
    try {
      return getWeekIdentifier(s.startedAt) === targetWeek;
    } catch {
      return false;
    }
  });

  const actualMinutes = weekSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const sessionCount = weekSessions.length;

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const roadmapMap = new Map(roadmaps.map((r) => [r.id, r]));
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  // Tasks worked on during this week
  const taskMinutesMap = new Map<string, { minutes: number; count: number }>();
  for (const s of weekSessions) {
    const curr = taskMinutesMap.get(s.taskId) ?? { minutes: 0, count: 0 };
    taskMinutesMap.set(s.taskId, {
      minutes: curr.minutes + s.durationMinutes,
      count: curr.count + 1,
    });
  }

  // Planned minutes
  let plannedMinutes = 0;
  let targetMinutes = 0;
  const taskPlannedMinutesMap = new Map<string, number>();

  if (weeklyPlan && weeklyPlan.weekIdentifier === targetWeek) {
    for (const item of weeklyPlan.items) {
      plannedMinutes += item.plannedMinutes;
      const curr = taskPlannedMinutesMap.get(item.taskId) ?? 0;
      taskPlannedMinutesMap.set(item.taskId, curr + item.plannedMinutes);
    }
    targetMinutes = weeklyPlan.targetMinutes > 0 ? weeklyPlan.targetMinutes : plannedMinutes;
  }

  const plannedVsActual = calculatePlannedVsActual(plannedMinutes, actualMinutes);

  // Combine tasks worked on
  const tasksWorkedOn: DailyTaskActivityDetail[] = [];
  let tasksCompletedCount = 0;

  for (const [taskId, stats] of taskMinutesMap.entries()) {
    const task = taskMap.get(taskId);
    const isCompleted = task?.status === 'completed';
    if (isCompleted) {
      tasksCompletedCount++;
    }
    const plannedForTask = taskPlannedMinutesMap.get(taskId) ?? 0;

    tasksWorkedOn.push({
      taskId,
      taskTitle: task?.title,
      roadmapId: task?.roadmapId,
      status: task?.status,
      isCompleted,
      plannedMinutes: plannedForTask,
      actualMinutes: stats.minutes,
      sessionCount: stats.count,
      varianceMinutes: stats.minutes - plannedForTask,
    });
  }

  tasksWorkedOn.sort((a, b) => b.actualMinutes - a.actualMinutes);

  // Task completion %
  let taskCompletionPercentage = 0;
  if (weeklyPlan && weeklyPlan.items.length > 0) {
    const distinctPlannedTaskIds = Array.from(new Set(weeklyPlan.items.map((i) => i.taskId)));
    const completedPlanned = distinctPlannedTaskIds.filter(
      (id) => taskMap.get(id)?.status === 'completed'
    ).length;
    taskCompletionPercentage = Math.round((completedPlanned / distinctPlannedTaskIds.length) * 100);
  } else if (tasksWorkedOn.length > 0) {
    taskCompletionPercentage = Math.round((tasksCompletedCount / tasksWorkedOn.length) * 100);
  }

  // Roadmap-level progress for this week
  const roadmapsWithActivity = new Set<string>();
  for (const t of tasksWorkedOn) {
    if (t.roadmapId) roadmapsWithActivity.add(t.roadmapId);
  }
  if (weeklyPlan) {
    for (const item of weeklyPlan.items) {
      const task = taskMap.get(item.taskId);
      if (task) roadmapsWithActivity.add(task.roadmapId);
    }
  }

  const roadmapProgress: RoadmapReviewProgress[] = [];
  for (const roadmapId of roadmapsWithActivity) {
    const roadmap = roadmapMap.get(roadmapId);
    if (!roadmap) continue;

    const rTasks = tasks.filter((t) => t.roadmapId === roadmapId && t.status !== 'cancelled');
    const rCompleted = rTasks.filter((t) => t.status === 'completed').length;
    const rTaskCompletion = rTasks.length > 0 ? Math.round((rCompleted / rTasks.length) * 100) : 0;

    const rPlannedMinutes = weeklyPlan
      ? weeklyPlan.items
          .filter((item) => {
            const t = taskMap.get(item.taskId);
            return t?.roadmapId === roadmapId;
          })
          .reduce((sum, i) => sum + i.plannedMinutes, 0)
      : 0;

    const rTaskIds = new Set(rTasks.map((t) => t.id));
    const rSessions = weekSessions.filter((s) => rTaskIds.has(s.taskId));
    const rActualMinutes = rSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

    roadmapProgress.push({
      roadmapId,
      roadmapTitle: roadmap.title,
      goalId: roadmap.goalId,
      totalTasks: rTasks.length,
      completedTasks: rCompleted,
      taskCompletionPercentage: rTaskCompletion,
      plannedMinutes: rPlannedMinutes,
      actualMinutes: rActualMinutes,
      varianceMinutes: rActualMinutes - rPlannedMinutes,
      sessionCount: rSessions.length,
    });
  }

  // Goal-level progress for this week
  const goalsWithActivity = new Set<string>();
  for (const rp of roadmapProgress) {
    goalsWithActivity.add(rp.goalId);
  }

  const goalProgress: GoalReviewProgress[] = [];
  for (const goalId of goalsWithActivity) {
    const goal = goalMap.get(goalId);
    if (!goal) continue;

    const gRoadmapProgress = roadmapProgress.filter((rp) => rp.goalId === goalId);
    const gRoadmaps = roadmaps.filter((r) => r.goalId === goalId);
    const gTasks = tasks.filter((t) => {
      const r = roadmapMap.get(t.roadmapId);
      return r?.goalId === goalId && t.status !== 'cancelled';
    });
    const gCompleted = gTasks.filter((t) => t.status === 'completed').length;
    const gTaskCompletion = gTasks.length > 0 ? Math.round((gCompleted / gTasks.length) * 100) : 0;

    const gPlanned = gRoadmapProgress.reduce((sum, rp) => sum + rp.plannedMinutes, 0);
    const gActual = gRoadmapProgress.reduce((sum, rp) => sum + rp.actualMinutes, 0);
    const gSessions = gRoadmapProgress.reduce((sum, rp) => sum + rp.sessionCount, 0);

    goalProgress.push({
      goalId,
      goalTitle: goal.title,
      totalRoadmaps: gRoadmaps.length,
      totalTasks: gTasks.length,
      completedTasks: gCompleted,
      taskCompletionPercentage: gTaskCompletion,
      plannedMinutes: gPlanned,
      actualMinutes: gActual,
      varianceMinutes: gActual - gPlanned,
      sessionCount: gSessions,
    });
  }

  return {
    weekIdentifier: targetWeek,
    dateRange,
    plannedMinutes,
    targetMinutes,
    actualMinutes,
    sessionCount,
    tasksWorkedOnCount: tasksWorkedOn.length,
    tasksCompletedCount,
    taskCompletionPercentage,
    timeCompletionPercentage: plannedVsActual.percentage,
    plannedVsActual,
    hasWeeklyPlan: Boolean(weeklyPlan),
    tasksWorkedOn,
    roadmapProgress,
    goalProgress,
  };
}

// =============================================================================
// C. Project, Roadmap & Goal Multi-Level Progress
// =============================================================================

export interface TaskDetailedProgress {
  readonly taskId: EntityId;
  readonly title: string;
  readonly status: TaskStatus;
  readonly estimatedMinutes: number;
  readonly plannedMinutesInPlans: number;
  readonly actualMinutes: number;
  readonly sessionCount: number;
  readonly varianceMinutes: number; // actual - estimated
  readonly isCompleted: boolean;
}

export interface RoadmapDetailedProgress {
  readonly roadmapId: EntityId;
  readonly title: string;
  readonly goalId: EntityId;
  readonly totalTasks: number;
  readonly activeTasks: number; // total - cancelled
  readonly completedTasks: number;
  readonly inProgressTasks: number;
  readonly todoTasks: number;
  readonly blockedTasks: number;
  readonly cancelledTasks: number;
  readonly taskCompletionPercentage: number;
  readonly totalEstimatedMinutes: number;
  readonly totalActualMinutes: number;
  readonly sessionCount: number;
  readonly timeCompletionPercentage: number;
  readonly varianceMinutes: number; // actual - estimated
  readonly tasks: readonly TaskDetailedProgress[];
}

export interface GoalDetailedProgress {
  readonly goalId: EntityId;
  readonly title: string;
  readonly description?: string;
  readonly totalRoadmaps: number;
  readonly completedRoadmaps: number;
  readonly totalTasks: number;
  readonly activeTasks: number;
  readonly completedTasks: number;
  readonly taskCompletionPercentage: number;
  readonly totalEstimatedMinutes: number;
  readonly totalActualMinutes: number;
  readonly sessionCount: number;
  readonly timeCompletionPercentage: number;
  readonly varianceMinutes: number;
  readonly roadmaps: readonly RoadmapDetailedProgress[];
}

/**
 * Calculates deep, structured progress for a single Roadmap.
 */
export function calculateDetailedRoadmapProgress(
  roadmap: Roadmap,
  tasks: readonly Task[],
  sessions: readonly Session[],
  weeklyPlans?: readonly WeeklyPlan[]
): RoadmapDetailedProgress {
  const rTasks = tasks.filter((t) => t.roadmapId === roadmap.id);

  let completedTasks = 0;
  let inProgressTasks = 0;
  let todoTasks = 0;
  let blockedTasks = 0;
  let cancelledTasks = 0;
  let totalEstimatedMinutes = 0;

  for (const t of rTasks) {
    totalEstimatedMinutes += t.estimatedMinutes;
    switch (t.status) {
      case 'completed':
        completedTasks++;
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

  const activeTasks = rTasks.length - cancelledTasks;
  const taskCompletionPercentage =
    activeTasks > 0 ? Math.round((completedTasks / activeTasks) * 100) : 0;

  // Task detailed items
  const taskDetails: TaskDetailedProgress[] = [];
  let totalActualMinutes = 0;
  let sessionCount = 0;

  for (const t of rTasks) {
    const tSessions = sessions.filter((s) => s.taskId === t.id && isValidSession(s));
    const tActual = tSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    totalActualMinutes += tActual;
    sessionCount += tSessions.length;

    let plannedInPlans = 0;
    if (weeklyPlans) {
      for (const p of weeklyPlans) {
        for (const item of p.items) {
          if (item.taskId === t.id) {
            plannedInPlans += item.plannedMinutes;
          }
        }
      }
    }

    taskDetails.push({
      taskId: t.id,
      title: t.title,
      status: t.status,
      estimatedMinutes: t.estimatedMinutes,
      plannedMinutesInPlans: plannedInPlans,
      actualMinutes: tActual,
      sessionCount: tSessions.length,
      varianceMinutes: tActual - t.estimatedMinutes,
      isCompleted: t.status === 'completed',
    });
  }

  const timeCompletionPercentage =
    totalEstimatedMinutes > 0
      ? Math.round((totalActualMinutes / totalEstimatedMinutes) * 100)
      : 0;

  return {
    roadmapId: roadmap.id,
    title: roadmap.title,
    goalId: roadmap.goalId,
    totalTasks: rTasks.length,
    activeTasks,
    completedTasks,
    inProgressTasks,
    todoTasks,
    blockedTasks,
    cancelledTasks,
    taskCompletionPercentage,
    totalEstimatedMinutes,
    totalActualMinutes,
    sessionCount,
    timeCompletionPercentage,
    varianceMinutes: totalActualMinutes - totalEstimatedMinutes,
    tasks: taskDetails,
  };
}

/**
 * Calculates deep, structured progress for a single Goal by aggregating its Roadmaps.
 */
export function calculateDetailedGoalProgress(
  goal: Goal,
  roadmaps: readonly Roadmap[],
  tasks: readonly Task[],
  sessions: readonly Session[],
  weeklyPlans?: readonly WeeklyPlan[]
): GoalDetailedProgress {
  const gRoadmaps = roadmaps.filter((r) => r.goalId === goal.id);
  const roadmapProgressList: RoadmapDetailedProgress[] = [];

  let totalTasks = 0;
  let activeTasks = 0;
  let completedTasks = 0;
  let totalEstimatedMinutes = 0;
  let totalActualMinutes = 0;
  let sessionCount = 0;
  let completedRoadmaps = 0;

  for (const r of gRoadmaps) {
    const rProg = calculateDetailedRoadmapProgress(r, tasks, sessions, weeklyPlans);
    roadmapProgressList.push(rProg);

    totalTasks += rProg.totalTasks;
    activeTasks += rProg.activeTasks;
    completedTasks += rProg.completedTasks;
    totalEstimatedMinutes += rProg.totalEstimatedMinutes;
    totalActualMinutes += rProg.totalActualMinutes;
    sessionCount += rProg.sessionCount;

    if (rProg.activeTasks > 0 && rProg.completedTasks === rProg.activeTasks) {
      completedRoadmaps++;
    }
  }

  const taskCompletionPercentage =
    activeTasks > 0 ? Math.round((completedTasks / activeTasks) * 100) : 0;

  const timeCompletionPercentage =
    totalEstimatedMinutes > 0
      ? Math.round((totalActualMinutes / totalEstimatedMinutes) * 100)
      : 0;

  return {
    goalId: goal.id,
    title: goal.title,
    description: goal.description,
    totalRoadmaps: gRoadmaps.length,
    completedRoadmaps,
    totalTasks,
    activeTasks,
    completedTasks,
    taskCompletionPercentage,
    totalEstimatedMinutes,
    totalActualMinutes,
    sessionCount,
    timeCompletionPercentage,
    varianceMinutes: totalActualMinutes - totalEstimatedMinutes,
    roadmaps: roadmapProgressList,
  };
}

// =============================================================================
// D. Historical Activity Aggregations (Date, Week, Task, Roadmap, Goal)
// =============================================================================

export interface DateActivityItem {
  readonly date: string; // YYYY-MM-DD
  readonly totalActualMinutes: number;
  readonly sessionCount: number;
  readonly distinctTasksWorkedOn: number;
}

export interface WeekActivityItem {
  readonly weekIdentifier: string; // YYYY-Www
  readonly totalActualMinutes: number;
  readonly sessionCount: number;
  readonly distinctTasksWorkedOn: number;
  readonly startDate: string;
  readonly endDate: string;
}

export interface TaskActivityItem {
  readonly taskId: EntityId;
  readonly title?: string;
  readonly roadmapId?: EntityId;
  readonly totalActualMinutes: number;
  readonly sessionCount: number;
  readonly firstSessionAt?: Timestamp;
  readonly lastSessionAt?: Timestamp;
}

export interface RoadmapActivityItem {
  readonly roadmapId: EntityId;
  readonly title?: string;
  readonly goalId?: EntityId;
  readonly totalActualMinutes: number;
  readonly sessionCount: number;
  readonly distinctTasksWorkedOn: number;
}

export interface GoalActivityItem {
  readonly goalId: EntityId;
  readonly title?: string;
  readonly totalActualMinutes: number;
  readonly sessionCount: number;
  readonly distinctRoadmapsWorkedOn: number;
  readonly distinctTasksWorkedOn: number;
}

/**
 * Aggregates historical sessions chronologically by calendar date.
 */
export function aggregateActivityByDate(
  sessions: readonly Session[],
  range?: DateRange
): readonly DateActivityItem[] {
  const map = new Map<string, { minutes: number; count: number; tasks: Set<string> }>();

  for (const s of sessions) {
    if (!isValidSession(s)) continue;
    const d = s.startedAt.split('T')[0];
    if (range && !isDateWithinRange(d, range)) continue;

    const curr = map.get(d) ?? { minutes: 0, count: 0, tasks: new Set() };
    curr.minutes += s.durationMinutes;
    curr.count += 1;
    curr.tasks.add(s.taskId);
    map.set(d, curr);
  }

  const sortedDates = Array.from(map.keys()).sort();
  return sortedDates.map((date) => {
    const data = map.get(date)!;
    return {
      date,
      totalActualMinutes: data.minutes,
      sessionCount: data.count,
      distinctTasksWorkedOn: data.tasks.size,
    };
  });
}

/**
 * Aggregates historical sessions chronologically by ISO week.
 */
export function aggregateActivityByWeek(
  sessions: readonly Session[]
): readonly WeekActivityItem[] {
  const map = new Map<string, { minutes: number; count: number; tasks: Set<string> }>();

  for (const s of sessions) {
    if (!isValidSession(s)) continue;
    try {
      const weekId = getWeekIdentifier(s.startedAt);
      const curr = map.get(weekId) ?? { minutes: 0, count: 0, tasks: new Set() };
      curr.minutes += s.durationMinutes;
      curr.count += 1;
      curr.tasks.add(s.taskId);
      map.set(weekId, curr);
    } catch {
      continue;
    }
  }

  const sortedWeeks = Array.from(map.keys()).sort();
  return sortedWeeks.map((weekIdentifier) => {
    const data = map.get(weekIdentifier)!;
    const period = getWeekPeriod(weekIdentifier);
    return {
      weekIdentifier,
      totalActualMinutes: data.minutes,
      sessionCount: data.count,
      distinctTasksWorkedOn: data.tasks.size,
      startDate: period.startDate,
      endDate: period.endDate,
    };
  });
}

/**
 * Aggregates historical sessions by Task ID.
 */
export function aggregateActivityByTask(
  sessions: readonly Session[],
  tasks?: readonly Task[]
): readonly TaskActivityItem[] {
  const map = new Map<
    string,
    { minutes: number; count: number; firstAt?: Timestamp; lastAt?: Timestamp }
  >();

  for (const s of sessions) {
    if (!isValidSession(s)) continue;
    const curr = map.get(s.taskId) ?? { minutes: 0, count: 0 };
    curr.minutes += s.durationMinutes;
    curr.count += 1;
    if (!curr.firstAt || s.startedAt < curr.firstAt) curr.firstAt = s.startedAt;
    if (!curr.lastAt || s.startedAt > curr.lastAt) curr.lastAt = s.startedAt;
    map.set(s.taskId, curr);
  }

  const taskMap = tasks ? new Map(tasks.map((t) => [t.id, t])) : null;

  return Array.from(map.entries())
    .map(([taskId, data]) => {
      const task = taskMap?.get(taskId);
      return {
        taskId,
        title: task?.title,
        roadmapId: task?.roadmapId,
        totalActualMinutes: data.minutes,
        sessionCount: data.count,
        firstSessionAt: data.firstAt,
        lastSessionAt: data.lastAt,
      };
    })
    .sort((a, b) => b.totalActualMinutes - a.totalActualMinutes);
}

/**
 * Aggregates historical sessions by Roadmap.
 */
export function aggregateActivityByRoadmap(
  sessions: readonly Session[],
  tasks: readonly Task[],
  roadmaps?: readonly Roadmap[]
): readonly RoadmapActivityItem[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const roadmapMap = roadmaps ? new Map(roadmaps.map((r) => [r.id, r])) : null;

  const map = new Map<string, { minutes: number; count: number; tasks: Set<string> }>();

  for (const s of sessions) {
    if (!isValidSession(s)) continue;
    const task = taskMap.get(s.taskId);
    if (!task) continue;

    const rId = task.roadmapId;
    const curr = map.get(rId) ?? { minutes: 0, count: 0, tasks: new Set() };
    curr.minutes += s.durationMinutes;
    curr.count += 1;
    curr.tasks.add(task.id);
    map.set(rId, curr);
  }

  return Array.from(map.entries())
    .map(([roadmapId, data]) => {
      const roadmap = roadmapMap?.get(roadmapId);
      return {
        roadmapId,
        title: roadmap?.title,
        goalId: roadmap?.goalId,
        totalActualMinutes: data.minutes,
        sessionCount: data.count,
        distinctTasksWorkedOn: data.tasks.size,
      };
    })
    .sort((a, b) => b.totalActualMinutes - a.totalActualMinutes);
}

/**
 * Aggregates historical sessions by Goal.
 */
export function aggregateActivityByGoal(
  sessions: readonly Session[],
  tasks: readonly Task[],
  roadmaps: readonly Roadmap[],
  goals?: readonly Goal[]
): readonly GoalActivityItem[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const roadmapMap = new Map(roadmaps.map((r) => [r.id, r]));
  const goalMap = goals ? new Map(goals.map((g) => [g.id, g])) : null;

  const map = new Map<
    string,
    { minutes: number; count: number; roadmaps: Set<string>; tasks: Set<string> }
  >();

  for (const s of sessions) {
    if (!isValidSession(s)) continue;
    const task = taskMap.get(s.taskId);
    if (!task) continue;
    const roadmap = roadmapMap.get(task.roadmapId);
    if (!roadmap) continue;

    const gId = roadmap.goalId;
    const curr = map.get(gId) ?? {
      minutes: 0,
      count: 0,
      roadmaps: new Set(),
      tasks: new Set(),
    };
    curr.minutes += s.durationMinutes;
    curr.count += 1;
    curr.roadmaps.add(roadmap.id);
    curr.tasks.add(task.id);
    map.set(gId, curr);
  }

  return Array.from(map.entries())
    .map(([goalId, data]) => {
      const goal = goalMap?.get(goalId);
      return {
        goalId,
        title: goal?.title,
        totalActualMinutes: data.minutes,
        sessionCount: data.count,
        distinctRoadmapsWorkedOn: data.roadmaps.size,
        distinctTasksWorkedOn: data.tasks.size,
      };
    })
    .sort((a, b) => b.totalActualMinutes - a.totalActualMinutes);
}

// =============================================================================
// F. Progress Over Time (Chronological Time Series)
// =============================================================================

export interface ProgressTimePoint {
  readonly date: string; // YYYY-MM-DD
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly sessionCount: number;
  readonly completedTaskCount: number;
  readonly varianceMinutes: number;
  readonly cumulativePlannedMinutes: number;
  readonly cumulativeActualMinutes: number;
  readonly cumulativeVarianceMinutes: number;
}

/**
 * Generates daily chronological progress points across a DateRange.
 * Suitable for linear progress charts, timeline graphs, or historical auditing.
 */
export function calculateProgressOverTime(params: {
  range: DateRange;
  sessions: readonly Session[];
  weeklyPlans?: readonly WeeklyPlan[];
  tasks?: readonly Task[];
}): readonly ProgressTimePoint[] {
  const { range, sessions, weeklyPlans, tasks } = params;
  const dates = getDatesInRange(range);

  // Pre-index sessions by date
  const sessionsByDate = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!isValidSession(s)) continue;
    const d = s.startedAt.split('T')[0];
    const existing = sessionsByDate.get(d) ?? [];
    existing.push(s);
    sessionsByDate.set(d, existing);
  }

  // Pre-index planned items by date
  const plannedMinutesByDate = new Map<string, number>();
  if (weeklyPlans) {
    for (const plan of weeklyPlans) {
      for (const item of plan.items) {
        if (item.targetDate) {
          const curr = plannedMinutesByDate.get(item.targetDate) ?? 0;
          plannedMinutesByDate.set(item.targetDate, curr + item.plannedMinutes);
        }
      }
    }
  }

  const taskMap = tasks ? new Map(tasks.map((t) => [t.id, t])) : null;

  let cumulativePlanned = 0;
  let cumulativeActual = 0;

  return dates.map((date) => {
    const daySessions = sessionsByDate.get(date) ?? [];
    const dayActual = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const dayPlanned = plannedMinutesByDate.get(date) ?? 0;

    cumulativePlanned += dayPlanned;
    cumulativeActual += dayActual;

    let completedTasks = 0;
    if (taskMap) {
      const dayTaskIds = new Set(daySessions.map((s) => s.taskId));
      for (const tid of dayTaskIds) {
        if (taskMap.get(tid)?.status === 'completed') {
          completedTasks++;
        }
      }
    }

    return {
      date,
      plannedMinutes: dayPlanned,
      actualMinutes: dayActual,
      sessionCount: daySessions.length,
      completedTaskCount: completedTasks,
      varianceMinutes: dayActual - dayPlanned,
      cumulativePlannedMinutes: cumulativePlanned,
      cumulativeActualMinutes: cumulativeActual,
      cumulativeVarianceMinutes: cumulativeActual - cumulativePlanned,
    };
  });
}

// =============================================================================
// G. Period Progress Summary (Arbitrary Date Ranges)
// =============================================================================

export interface PeriodProgressSummary {
  readonly range: DateRange;
  readonly totalActualMinutes: number;
  readonly totalPlannedMinutes: number;
  readonly varianceMinutes: number;
  readonly timeCompletionPercentage: number;
  readonly totalSessions: number;
  readonly distinctTasksWorkedOn: number;
  readonly completedTasksCount: number;
  readonly plannedVsActual: PlannedVsActualComparison;
  readonly dailyTimePoints: readonly ProgressTimePoint[];
  readonly topTasksByTime: readonly TaskActivityItem[];
}

/**
 * Summarizes progress and activity over any arbitrary DateRange.
 */
export function calculatePeriodProgressSummary(
  range: DateRange,
  sessions: readonly Session[],
  tasks: readonly Task[],
  weeklyPlans?: readonly WeeklyPlan[]
): PeriodProgressSummary {
  // Filter sessions within range
  const periodSessions = sessions.filter(
    (s) => isValidSession(s) && isDateWithinRange(s.startedAt, range)
  );

  const totalActualMinutes = periodSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalSessions = periodSessions.length;

  const dates = getDatesInRange(range);
  const datesSet = new Set(dates);

  // Sum planned minutes for dates in this range
  let totalPlannedMinutes = 0;
  if (weeklyPlans) {
    for (const plan of weeklyPlans) {
      for (const item of plan.items) {
        if (item.targetDate && datesSet.has(item.targetDate)) {
          totalPlannedMinutes += item.plannedMinutes;
        }
      }
    }
  }

  const plannedVsActual = calculatePlannedVsActual(totalPlannedMinutes, totalActualMinutes);

  const workedTaskIds = new Set(periodSessions.map((s) => s.taskId));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  let completedTasksCount = 0;
  for (const tid of workedTaskIds) {
    if (taskMap.get(tid)?.status === 'completed') {
      completedTasksCount++;
    }
  }

  const dailyTimePoints = calculateProgressOverTime({
    range,
    sessions: periodSessions,
    weeklyPlans,
    tasks,
  });

  const topTasksByTime = aggregateActivityByTask(periodSessions, tasks);

  return {
    range,
    totalActualMinutes,
    totalPlannedMinutes,
    varianceMinutes: totalActualMinutes - totalPlannedMinutes,
    timeCompletionPercentage: plannedVsActual.percentage,
    totalSessions,
    distinctTasksWorkedOn: workedTaskIds.size,
    completedTasksCount,
    plannedVsActual,
    dailyTimePoints,
    topTasksByTime,
  };
}

// =============================================================================
// H. Historical Project Progress & Reconstruction
// =============================================================================

export interface ProjectHistorySnapshot {
  readonly asOfDate?: string;
  readonly totalGoals: number;
  readonly totalRoadmaps: number;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly overallTaskCompletionPercentage: number;
  readonly totalActualMinutes: number;
  readonly totalEstimatedMinutes: number;
  readonly totalSessions: number;
  readonly goals: readonly GoalDetailedProgress[];
}

/**
 * Reconstructs the complete project hierarchy (Goal -> Roadmap -> Task -> Sessions)
 * optionally constrained as of a historical date without storing redundant snapshots.
 */
export function reconstructProjectHistory(params: {
  goals: readonly Goal[];
  roadmaps: readonly Roadmap[];
  tasks: readonly Task[];
  sessions: readonly Session[];
  weeklyPlans?: readonly WeeklyPlan[];
  asOfDate?: string;
}): ProjectHistorySnapshot {
  const { goals, roadmaps, tasks, sessions, weeklyPlans, asOfDate } = params;

  let effectiveSessions = sessions.filter(isValidSession);
  if (asOfDate) {
    const cleanAsOf = asOfDate.trim().split('T')[0];
    effectiveSessions = effectiveSessions.filter((s) => s.startedAt.split('T')[0] <= cleanAsOf);
  }

  const goalProgressList: GoalDetailedProgress[] = [];
  let totalTasks = 0;
  let activeTasks = 0;
  let completedTasks = 0;
  let totalEstimatedMinutes = 0;
  let totalActualMinutes = 0;
  let totalSessions = 0;

  for (const goal of goals) {
    const gProg = calculateDetailedGoalProgress(goal, roadmaps, tasks, effectiveSessions, weeklyPlans);
    goalProgressList.push(gProg);

    totalTasks += gProg.totalTasks;
    activeTasks += gProg.activeTasks;
    completedTasks += gProg.completedTasks;
    totalEstimatedMinutes += gProg.totalEstimatedMinutes;
    totalActualMinutes += gProg.totalActualMinutes;
    totalSessions += gProg.sessionCount;
  }

  const overallTaskCompletionPercentage =
    activeTasks > 0 ? Math.round((completedTasks / activeTasks) * 100) : 0;

  return {
    asOfDate,
    totalGoals: goals.length,
    totalRoadmaps: roadmaps.length,
    totalTasks,
    completedTasks,
    overallTaskCompletionPercentage,
    totalActualMinutes,
    totalEstimatedMinutes,
    totalSessions,
    goals: goalProgressList,
  };
}

// =============================================================================
// I. Full Progress Review Report (For Future Teacher / Student Review)
// =============================================================================

export interface ProgressReviewReport {
  readonly generatedAt: Timestamp;
  readonly period: DateRange;
  readonly executiveSummary: {
    readonly totalActualMinutes: number;
    readonly totalEstimatedMinutes: number;
    readonly totalPlannedMinutes: number;
    readonly totalSessions: number;
    readonly totalGoals: number;
    readonly totalRoadmaps: number;
    readonly totalTasks: number;
    readonly completedTasks: number;
    readonly inProgressTasks: number;
    readonly overallTaskCompletionPercentage: number;
    readonly overallTimeCompletionPercentage: number;
    readonly totalVarianceMinutes: number;
  };
  readonly goals: readonly GoalDetailedProgress[];
  readonly roadmaps: readonly RoadmapDetailedProgress[];
  readonly recentWeeks: readonly WeeklyReviewSummary[];
  readonly timeSeries: readonly ProgressTimePoint[];
  readonly activityByDate: readonly DateActivityItem[];
  readonly activityByTask: readonly TaskActivityItem[];
}

/**
 * Generates an end-to-end ProgressReviewReport consolidating executive summaries,
 * hierarchy progress, chronological time series, and historical activity.
 * Designed to cleanly feed future Teacher View dashboards and student review interfaces.
 */
export function generateProgressReviewReport(params: {
  goals: readonly Goal[];
  roadmaps: readonly Roadmap[];
  tasks: readonly Task[];
  sessions: readonly Session[];
  weeklyPlans: readonly WeeklyPlan[];
  period?: DateRange;
}): ProgressReviewReport {
  const { goals, roadmaps, tasks, sessions, weeklyPlans } = params;
  const effectivePeriod = params.period ?? getLastNDaysPeriod(30);

  const goalDetailedList = goals.map((g) =>
    calculateDetailedGoalProgress(g, roadmaps, tasks, sessions, weeklyPlans)
  );

  const roadmapDetailedList = roadmaps.map((r) =>
    calculateDetailedRoadmapProgress(r, tasks, sessions, weeklyPlans)
  );

  let totalEstimatedMinutes = 0;
  let inProgressTasks = 0;
  for (const t of tasks) {
    totalEstimatedMinutes += t.estimatedMinutes;
    if (t.status === 'in_progress') inProgressTasks++;
  }

  const validSessions = sessions.filter(isValidSession);
  const totalActualMinutes = validSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  let totalPlannedMinutes = 0;
  for (const p of weeklyPlans) {
    for (const item of p.items) {
      totalPlannedMinutes += item.plannedMinutes;
    }
  }

  const activeTasks = tasks.filter((t) => t.status !== 'cancelled');
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const overallTaskCompletionPercentage =
    activeTasks.length > 0 ? Math.round((completedTasks / activeTasks.length) * 100) : 0;
  const overallTimeCompletionPercentage =
    totalEstimatedMinutes > 0 ? Math.round((totalActualMinutes / totalEstimatedMinutes) * 100) : 0;

  // Recent weeks breakdown (e.g. from weekly plans or recent 4 weeks)
  const weekSet = new Set<string>();
  for (const p of weeklyPlans) {
    weekSet.add(p.weekIdentifier);
  }
  for (const s of validSessions) {
    try {
      weekSet.add(getWeekIdentifier(s.startedAt));
    } catch {
      continue;
    }
  }

  const recentWeekIds = Array.from(weekSet).sort().slice(-8); // up to 8 most recent
  const recentWeeks = recentWeekIds.map((wId) => {
    const plan = weeklyPlans.find((p) => p.weekIdentifier === wId) ?? null;
    return calculateWeeklyReviewSummary(wId, sessions, tasks, roadmaps, goals, plan);
  });

  const timeSeries = calculateProgressOverTime({
    range: effectivePeriod,
    sessions,
    weeklyPlans,
    tasks,
  });

  const activityByDate = aggregateActivityByDate(sessions, effectivePeriod);
  const activityByTask = aggregateActivityByTask(sessions, tasks);

  return {
    generatedAt: createTimestamp(),
    period: effectivePeriod,
    executiveSummary: {
      totalActualMinutes,
      totalEstimatedMinutes,
      totalPlannedMinutes,
      totalSessions: validSessions.length,
      totalGoals: goals.length,
      totalRoadmaps: roadmaps.length,
      totalTasks: tasks.length,
      completedTasks,
      inProgressTasks,
      overallTaskCompletionPercentage,
      overallTimeCompletionPercentage,
      totalVarianceMinutes: totalActualMinutes - totalPlannedMinutes,
    },
    goals: goalDetailedList,
    roadmaps: roadmapDetailedList,
    recentWeeks,
    timeSeries,
    activityByDate,
    activityByTask,
  };
}

// =============================================================================
// J. Comprehensive Period Review (Phase 11A Core)
// =============================================================================

export interface PeriodSpecification {
  readonly type: 'this-week' | 'last-week' | 'custom';
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string;   // YYYY-MM-DD
  readonly weekIdentifier?: string; // e.g. "2026-W39"
  readonly label: string;
}

export interface GoalPeriodProgress {
  readonly goalId: EntityId;
  readonly title: string;
  readonly status: string;
  readonly totalRoadmaps: number;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly taskCompletionPercentage: number;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly hasActivityInPeriod: boolean;
}

export interface RoadmapPeriodProgress {
  readonly roadmapId: EntityId;
  readonly title: string;
  readonly goalId: EntityId;
  readonly goalTitle: string;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly taskCompletionPercentage: number;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly hasActivityInPeriod: boolean;
}

export interface TaskPeriodActivity {
  readonly taskId: EntityId;
  readonly title: string;
  readonly roadmapId?: EntityId;
  readonly roadmapTitle: string;
  readonly status: TaskStatus;
  readonly isCompleted: boolean;
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly sessionCount: number;
}

export interface DailyPeriodReview {
  readonly date: string; // YYYY-MM-DD
  readonly dayOfWeek: number; // 1 = Monday ... 7 = Sunday
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly sessionCount: number;
  readonly tasksWorkedOnCount: number;
  readonly tasksCompletedCount: number;
}

export interface ComprehensivePeriodReview {
  readonly period: PeriodSpecification;
  readonly summary: {
    readonly totalPlannedMinutes: number;
    readonly totalActualMinutes: number;
    readonly varianceMinutes: number; // actual - planned
    readonly timeCompletionPercentage: number;
    readonly tasksWorkedOnCount: number;
    readonly tasksCompletedCount: number;
    readonly plannedCommitmentsCount: number;
    readonly completedCommitmentsCount: number;
  };
  readonly goals: readonly GoalPeriodProgress[];
  readonly roadmaps: readonly RoadmapPeriodProgress[];
  readonly tasks: readonly TaskPeriodActivity[];
  readonly dailyBreakdown: readonly DailyPeriodReview[];
}

export function calculateComprehensivePeriodReview(params: {
  readonly period: PeriodSpecification;
  readonly sessions: readonly Session[];
  readonly tasks: readonly Task[];
  readonly roadmaps: readonly Roadmap[];
  readonly goals: readonly Goal[];
  readonly weeklyPlans: readonly WeeklyPlan[];
}): ComprehensivePeriodReview {
  const { period, sessions, tasks, roadmaps, goals, weeklyPlans } = params;
  const { startDate, endDate, weekIdentifier } = period;

  // 1. Identify relevant sessions in range
  const validSessions = sessions.filter(
    (s) =>
      isValidSession(s) &&
      s.startedAt.split('T')[0] >= startDate &&
      s.startedAt.split('T')[0] <= endDate
  );

  const totalActualMinutes = validSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  // 2. Identify relevant planned items in period
  // If weekIdentifier is present, use that specific weekly plan
  let plannedItems: Array<{
    readonly id: string;
    readonly taskId: string;
    readonly plannedMinutes: number;
    readonly targetDate?: string;
    readonly isCompleted: boolean;
  }> = [];

  if (weekIdentifier) {
    const plan = weeklyPlans.find((p) => p.weekIdentifier === weekIdentifier);
    if (plan) {
      plannedItems = [...plan.items];
    }
  } else {
    // Custom range: include dated items in range, plus flexible items for plans whose full week is in range
    for (const plan of weeklyPlans) {
      const planRange = getWeekPeriod(plan.weekIdentifier);
      const isPlanFullyInRange = planRange.startDate >= startDate && planRange.endDate <= endDate;

      for (const item of plan.items) {
        if (item.targetDate) {
          if (item.targetDate >= startDate && item.targetDate <= endDate) {
            plannedItems.push(item);
          }
        } else if (isPlanFullyInRange) {
          plannedItems.push(item);
        }
      }
    }
  }

  const totalPlannedMinutes = plannedItems.reduce((sum, item) => sum + item.plannedMinutes, 0);
  const plannedCommitmentsCount = plannedItems.length;
  const completedCommitmentsCount = plannedItems.filter((item) => item.isCompleted).length;

  const varianceMinutes = totalActualMinutes - totalPlannedMinutes;
  const timeCompletionPercentage =
    totalPlannedMinutes > 0 ? Math.round((totalActualMinutes / totalPlannedMinutes) * 100) : 0;

  // Maps for fast lookups
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const roadmapMap = new Map(roadmaps.map((r) => [r.id, r]));
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  // 3. Task Activity aggregation
  const taskSessionsMap = new Map<string, { minutes: number; count: number }>();
  for (const s of validSessions) {
    const curr = taskSessionsMap.get(s.taskId) ?? { minutes: 0, count: 0 };
    taskSessionsMap.set(s.taskId, {
      minutes: curr.minutes + s.durationMinutes,
      count: curr.count + 1,
    });
  }

  const taskPlannedMap = new Map<string, number>();
  for (const item of plannedItems) {
    const curr = taskPlannedMap.get(item.taskId) ?? 0;
    taskPlannedMap.set(item.taskId, curr + item.plannedMinutes);
  }

  const allRelevantTaskIds = new Set<string>([
    ...taskSessionsMap.keys(),
    ...taskPlannedMap.keys(),
  ]);

  const taskActivities: TaskPeriodActivity[] = [];
  let tasksCompletedCount = 0;

  for (const taskId of allRelevantTaskIds) {
    const task = taskMap.get(taskId);
    const sessionData = taskSessionsMap.get(taskId) ?? { minutes: 0, count: 0 };
    const plannedForTask = taskPlannedMap.get(taskId) ?? 0;
    const isCompleted = task?.status === 'completed';

    if (isCompleted) {
      tasksCompletedCount++;
    }

    const rTitle = task?.roadmapId ? roadmapMap.get(task.roadmapId)?.title ?? 'General' : 'General';

    taskActivities.push({
      taskId,
      title: task?.title ?? 'Unknown Task',
      roadmapId: task?.roadmapId,
      roadmapTitle: rTitle,
      status: task?.status ?? 'todo',
      isCompleted,
      plannedMinutes: plannedForTask,
      actualMinutes: sessionData.minutes,
      sessionCount: sessionData.count,
    });
  }

  // Sort tasks by actual minutes descending, then planned minutes descending
  taskActivities.sort((a, b) => b.actualMinutes - a.actualMinutes || b.plannedMinutes - a.plannedMinutes);

  const tasksWorkedOnCount = taskSessionsMap.size;

  // 4. Roadmap-level Progress
  const roadmapsProgress: RoadmapPeriodProgress[] = roadmaps.map((roadmap) => {
    const rProg = calculateDetailedRoadmapProgress(roadmap, tasks, sessions, weeklyPlans);
    const parentGoal = goalMap.get(roadmap.goalId);

    // Compute period-specific minutes for this roadmap
    let rActual = 0;
    let rPlanned = 0;

    const rTaskIds = new Set(tasks.filter((t) => t.roadmapId === roadmap.id).map((t) => t.id));
    for (const [tId, sData] of taskSessionsMap.entries()) {
      if (rTaskIds.has(tId)) {
        rActual += sData.minutes;
      }
    }
    for (const [tId, pMinutes] of taskPlannedMap.entries()) {
      if (rTaskIds.has(tId)) {
        rPlanned += pMinutes;
      }
    }

    const hasActivity = rActual > 0 || rPlanned > 0;

    return {
      roadmapId: roadmap.id,
      title: roadmap.title,
      goalId: roadmap.goalId,
      goalTitle: parentGoal?.title ?? 'General',
      totalTasks: rProg.totalTasks,
      completedTasks: rProg.completedTasks,
      taskCompletionPercentage: rProg.taskCompletionPercentage,
      plannedMinutes: rPlanned,
      actualMinutes: rActual,
      hasActivityInPeriod: hasActivity,
    };
  });

  // Sort: active roadmaps first (by activity), then title
  roadmapsProgress.sort((a, b) => {
    if (a.hasActivityInPeriod !== b.hasActivityInPeriod) {
      return a.hasActivityInPeriod ? -1 : 1;
    }
    const aTotal = a.actualMinutes + a.plannedMinutes;
    const bTotal = b.actualMinutes + b.plannedMinutes;
    if (aTotal !== bTotal) return bTotal - aTotal;
    return a.title.localeCompare(b.title);
  });

  // 5. Goal-level Progress
  const goalsProgress: GoalPeriodProgress[] = goals.map((goal) => {
    const gProg = calculateDetailedGoalProgress(goal, roadmaps, tasks, sessions, weeklyPlans);
    const gRoadmapIds = new Set(roadmaps.filter((r) => r.goalId === goal.id).map((r) => r.id));
    const gTaskIds = new Set(tasks.filter((t) => gRoadmapIds.has(t.roadmapId)).map((t) => t.id));

    let gActual = 0;
    let gPlanned = 0;

    for (const [tId, sData] of taskSessionsMap.entries()) {
      if (gTaskIds.has(tId)) {
        gActual += sData.minutes;
      }
    }
    for (const [tId, pMinutes] of taskPlannedMap.entries()) {
      if (gTaskIds.has(tId)) {
        gPlanned += pMinutes;
      }
    }

    const hasActivity = gActual > 0 || gPlanned > 0;

    return {
      goalId: goal.id,
      title: goal.title,
      status: goal.status,
      totalRoadmaps: gProg.totalRoadmaps,
      totalTasks: gProg.totalTasks,
      completedTasks: gProg.completedTasks,
      taskCompletionPercentage: gProg.taskCompletionPercentage,
      plannedMinutes: gPlanned,
      actualMinutes: gActual,
      hasActivityInPeriod: hasActivity,
    };
  });

  goalsProgress.sort((a, b) => {
    if (a.hasActivityInPeriod !== b.hasActivityInPeriod) {
      return a.hasActivityInPeriod ? -1 : 1;
    }
    const aTotal = a.actualMinutes + a.plannedMinutes;
    const bTotal = b.actualMinutes + b.plannedMinutes;
    if (aTotal !== bTotal) return bTotal - aTotal;
    return a.title.localeCompare(b.title);
  });

  // 6. Daily Breakdown for each day in range
  const dates = getDatesInRange({ startDate, endDate });
  const dailyBreakdown: DailyPeriodReview[] = dates.map((dateStr) => {
    const dayDate = new Date(`${dateStr}T12:00:00.000Z`);
    const dayOfWeek = dayDate.getUTCDay() === 0 ? 7 : dayDate.getUTCDay();

    // Actual sessions for this day
    const daySessions = validSessions.filter((s) => s.startedAt.startsWith(dateStr));
    const dayActualMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);

    // Planned items specifically targeted for this day
    let dayPlannedMinutes = 0;
    const dayPlannedTaskIds = new Set<string>();
    for (const plan of weeklyPlans) {
      for (const item of plan.items) {
        if (item.targetDate === dateStr) {
          dayPlannedMinutes += item.plannedMinutes;
          dayPlannedTaskIds.add(item.taskId);
        }
      }
    }

    const dayWorkedTaskIds = new Set(daySessions.map((s) => s.taskId));
    const combinedDayTaskIds = new Set([...dayWorkedTaskIds, ...dayPlannedTaskIds]);

    let dayTasksCompletedCount = 0;
    for (const tId of combinedDayTaskIds) {
      if (taskMap.get(tId)?.status === 'completed') {
        dayTasksCompletedCount++;
      }
    }

    return {
      date: dateStr,
      dayOfWeek,
      plannedMinutes: dayPlannedMinutes,
      actualMinutes: dayActualMinutes,
      sessionCount: daySessions.length,
      tasksWorkedOnCount: dayWorkedTaskIds.size,
      tasksCompletedCount: dayTasksCompletedCount,
    };
  });

  return {
    period,
    summary: {
      totalPlannedMinutes,
      totalActualMinutes,
      varianceMinutes,
      timeCompletionPercentage,
      tasksWorkedOnCount,
      tasksCompletedCount,
      plannedCommitmentsCount,
      completedCommitmentsCount,
    },
    goals: goalsProgress,
    roadmaps: roadmapsProgress,
    tasks: taskActivities,
    dailyBreakdown,
  };
}

