/**
 * Report Generation Application Service
 *
 * Orchestrates domain services, calculations, and repositories to produce
 * structured, deterministic, strictly factual official progress reports.
 *
 * Adheres strictly to the PathFlow architecture:
 * Report UI -> ReportService -> Domain Services & Repositories -> Storage
 *
 * Observational & Factual: Never emits grades, rankings, productivity scores, or subjective labels.
 */

import {
  EntityId,
  Goal,
  Roadmap,
  Task,
  Session,
  WeeklyPlan,
  OfficialProgressReport,
  ReportMetadata,
  ReportOverview,
  ReportGoalItem,
  ReportRoadmapItem,
  ReportTaskItem,
  ReportSessionItem,
  ReportSessionsSummary,
  ReportWeeklyPlanningSummary,
  ReportDailyActivityItem,
  ReportScope,
  ReportScopeType,
  calculateDetailedGoalProgress,
  calculateDetailedRoadmapProgress,
  isValidSession,
  getDatesInRange,
} from '../../domain';
import {
  GoalRepository,
  RoadmapRepository,
  TaskRepository,
  SessionRepository,
  WeeklyPlanRepository,
} from '../../data/repositories/interfaces';
import { ProgressService } from '../progress/progressService';
import { handleRepositoryError } from '../errors';

export interface GenerateReportOptions {
  readonly periodType: 'this-week' | 'last-week' | 'custom';
  readonly customStartDate?: string;
  readonly customEndDate?: string;
  readonly referenceDate?: Date | string;
  readonly scope?: {
    readonly type: ReportScopeType;
    readonly goalId?: EntityId;
    readonly roadmapId?: EntityId;
  };
  readonly language?: 'en' | 'fa';
  readonly calendar?: 'gregorian' | 'persian';
  readonly title?: string;
}

export class ReportService {
  constructor(
    private readonly goalRepo: GoalRepository,
    private readonly roadmapRepo: RoadmapRepository,
    private readonly taskRepo: TaskRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly weeklyPlanRepo: WeeklyPlanRepository,
    private readonly progressService: ProgressService
  ) {}

  /**
   * Generates a deterministic, factual OfficialProgressReport.
   */
  async generateReport(options: GenerateReportOptions): Promise<OfficialProgressReport> {
    try {
      // 1. Derive base period review using existing domain calculations
      const periodReview = await this.progressService.getPeriodProgressReview({
        periodType: options.periodType,
        customStartDate: options.customStartDate,
        customEndDate: options.customEndDate,
        referenceDate: options.referenceDate,
      });

      const { startDate, endDate, weekIdentifier, label } = periodReview.period;

      // 2. Fetch all domain entities in parallel
      const [allGoals, allRoadmaps, allTasks, allSessions, allWeeklyPlans] = await Promise.all([
        this.goalRepo.getAll(),
        this.roadmapRepo.getAll(),
        this.taskRepo.getAll(),
        this.sessionRepo.getAll(),
        this.weeklyPlanRepo.getAll(),
      ]);

      const goalMap = new Map<string, Goal>(allGoals.map((g) => [g.id, g]));
      const roadmapMap = new Map<string, Roadmap>(allRoadmaps.map((r) => [r.id, r]));
      const taskMap = new Map<string, Task>(allTasks.map((t) => [t.id, t]));

      // 3. Resolve Scope
      const requestedScopeType = options.scope?.type ?? 'all';
      let scope: ReportScope = { type: 'all' };
      let targetGoals = allGoals;
      let targetRoadmaps = allRoadmaps;
      let targetTasks = allTasks;

      if (requestedScopeType === 'goal' && options.scope?.goalId) {
        const goal = goalMap.get(options.scope.goalId);
        if (goal) {
          scope = {
            type: 'goal',
            goalId: goal.id,
            goalTitle: goal.title,
          };
          targetGoals = [goal];
          targetRoadmaps = allRoadmaps.filter((r) => r.goalId === goal.id);
          const targetRoadmapIds = new Set(targetRoadmaps.map((r) => r.id));
          targetTasks = allTasks.filter((t) => targetRoadmapIds.has(t.roadmapId));
        }
      } else if (requestedScopeType === 'roadmap' && options.scope?.roadmapId) {
        const roadmap = roadmapMap.get(options.scope.roadmapId);
        if (roadmap) {
          const parentGoal = goalMap.get(roadmap.goalId);
          scope = {
            type: 'roadmap',
            roadmapId: roadmap.id,
            roadmapTitle: roadmap.title,
            goalId: parentGoal?.id,
            goalTitle: parentGoal?.title,
          };
          targetRoadmaps = [roadmap];
          targetGoals = parentGoal ? [parentGoal] : [];
          targetTasks = allTasks.filter((t) => t.roadmapId === roadmap.id);
        }
      }

      const targetTaskIds = new Set(targetTasks.map((t) => t.id));

      // 4. Filter period sessions belonging to target scope
      const validPeriodSessions = allSessions.filter(
        (s) =>
          isValidSession(s) &&
          targetTaskIds.has(s.taskId) &&
          s.startedAt.split('T')[0] >= startDate &&
          s.startedAt.split('T')[0] <= endDate
      );

      // Session map for period
      const taskPeriodSessionsMap = new Map<string, { minutes: number; count: number }>();
      for (const s of validPeriodSessions) {
        const curr = taskPeriodSessionsMap.get(s.taskId) ?? { minutes: 0, count: 0 };
        taskPeriodSessionsMap.set(s.taskId, {
          minutes: curr.minutes + s.durationMinutes,
          count: curr.count + 1,
        });
      }

      // 5. Weekly plan commitments in period belonging to target scope
      const plannedCommitments: Array<{
        readonly id: string;
        readonly taskId: string;
        readonly plannedMinutes: number;
        readonly targetDate?: string;
        readonly isCompleted: boolean;
      }> = [];

      if (weekIdentifier) {
        const plan = allWeeklyPlans.find((p) => p.weekIdentifier === weekIdentifier);
        if (plan) {
          for (const item of plan.items) {
            if (targetTaskIds.has(item.taskId)) {
              plannedCommitments.push(item);
            }
          }
        }
      } else {
        for (const plan of allWeeklyPlans) {
          for (const item of plan.items) {
            if (!targetTaskIds.has(item.taskId)) continue;
            if (item.targetDate) {
              if (item.targetDate >= startDate && item.targetDate <= endDate) {
                plannedCommitments.push(item);
              }
            } else {
              // Flexible commitment: include if plan week range overlaps
              plannedCommitments.push(item);
            }
          }
        }
      }

      const taskPlannedMinutesMap = new Map<string, number>();
      for (const item of plannedCommitments) {
        const curr = taskPlannedMinutesMap.get(item.taskId) ?? 0;
        taskPlannedMinutesMap.set(item.taskId, curr + item.plannedMinutes);
      }

      // 6. Build Goals Section (Lifetime vs Selected Period)
      const reportGoals: ReportGoalItem[] = targetGoals.map((goal) => {
        const gProg = calculateDetailedGoalProgress(goal, allRoadmaps, allTasks, allSessions, allWeeklyPlans);

        const gRoadmapIds = new Set(allRoadmaps.filter((r) => r.goalId === goal.id).map((r) => r.id));
        const gTasks = allTasks.filter((t) => gRoadmapIds.has(t.roadmapId));
        const gTaskIds = new Set(gTasks.map((t) => t.id));

        let selectedPeriodActualMinutes = 0;
        let selectedPeriodSessionCount = 0;
        let selectedPeriodPlannedMinutes = 0;

        for (const s of validPeriodSessions) {
          if (gTaskIds.has(s.taskId)) {
            selectedPeriodActualMinutes += s.durationMinutes;
            selectedPeriodSessionCount++;
          }
        }

        for (const item of plannedCommitments) {
          if (gTaskIds.has(item.taskId)) {
            selectedPeriodPlannedMinutes += item.plannedMinutes;
          }
        }

        const hasActivity = selectedPeriodActualMinutes > 0 || selectedPeriodPlannedMinutes > 0;

        return {
          id: goal.id,
          title: goal.title,
          description: goal.description,
          status: goal.status,
          overallProgressPercentage: gProg.taskCompletionPercentage,
          roadmapCount: gProg.totalRoadmaps,
          taskCount: gProg.totalTasks,
          completedTaskCount: gProg.completedTasks,
          lifetimePlannedMinutes: gProg.totalEstimatedMinutes,
          lifetimeActualMinutes: gProg.totalActualMinutes,
          selectedPeriodPlannedMinutes,
          selectedPeriodActualMinutes,
          selectedPeriodSessionCount,
          hasActivityInPeriod: hasActivity,
        };
      });

      // 7. Build Roadmaps Section (Lifetime vs Selected Period)
      const reportRoadmaps: ReportRoadmapItem[] = targetRoadmaps.map((roadmap) => {
        const rProg = calculateDetailedRoadmapProgress(roadmap, allTasks, allSessions, allWeeklyPlans);
        const parentGoal = goalMap.get(roadmap.goalId);

        const rTasks = allTasks.filter((t) => t.roadmapId === roadmap.id);
        const rTaskIds = new Set(rTasks.map((t) => t.id));

        let selectedPeriodActualMinutes = 0;
        let selectedPeriodSessionCount = 0;
        let selectedPeriodPlannedMinutes = 0;

        for (const s of validPeriodSessions) {
          if (rTaskIds.has(s.taskId)) {
            selectedPeriodActualMinutes += s.durationMinutes;
            selectedPeriodSessionCount++;
          }
        }

        for (const item of plannedCommitments) {
          if (rTaskIds.has(item.taskId)) {
            selectedPeriodPlannedMinutes += item.plannedMinutes;
          }
        }

        const hasActivity = selectedPeriodActualMinutes > 0 || selectedPeriodPlannedMinutes > 0;
        const roadmapStatus =
          rProg.totalTasks > 0 && rProg.completedTasks === rProg.totalTasks
            ? 'completed'
            : rProg.completedTasks > 0
            ? 'in_progress'
            : 'not_started';

        return {
          id: roadmap.id,
          title: roadmap.title,
          goalId: roadmap.goalId,
          goalTitle: parentGoal?.title ?? 'General',
          status: roadmapStatus,
          overallProgressPercentage: rProg.taskCompletionPercentage,
          taskCount: rProg.totalTasks,
          completedTaskCount: rProg.completedTasks,
          lifetimePlannedMinutes: rProg.totalEstimatedMinutes,
          lifetimeActualMinutes: rProg.totalActualMinutes,
          selectedPeriodPlannedMinutes,
          selectedPeriodActualMinutes,
          selectedPeriodSessionCount,
          hasActivityInPeriod: hasActivity,
        };
      });

      // 8. Build Tasks Section
      const reportTasks: ReportTaskItem[] = targetTasks.map((task) => {
        const roadmap = roadmapMap.get(task.roadmapId);
        const parentGoal = roadmap ? goalMap.get(roadmap.goalId) : undefined;

        // Lifetime sessions for this task
        const lifetimeSessions = allSessions.filter((s) => isValidSession(s) && s.taskId === task.id);
        const lifetimeActualMinutes = lifetimeSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

        const periodStats = taskPeriodSessionsMap.get(task.id) ?? { minutes: 0, count: 0 };
        const periodPlannedMinutes = taskPlannedMinutesMap.get(task.id) ?? 0;

        return {
          id: task.id,
          title: task.title,
          roadmapId: task.roadmapId,
          roadmapTitle: roadmap?.title ?? 'General',
          goalId: parentGoal?.id,
          goalTitle: parentGoal?.title,
          status: task.status,
          priority: task.priority,
          lifetimeEstimatedMinutes: task.estimatedMinutes,
          lifetimeActualMinutes,
          lifetimeSessionCount: lifetimeSessions.length,
          selectedPeriodPlannedMinutes: periodPlannedMinutes,
          selectedPeriodActualMinutes: periodStats.minutes,
          selectedPeriodSessionCount: periodStats.count,
          isCompleted: task.status === 'completed',
          completionDate: task.status === 'completed' && task.updatedAt ? task.updatedAt.split('T')[0] : undefined,
        };
      });

      // Sort tasks: tasks with period activity first, then by actual time, then status
      reportTasks.sort((a, b) => {
        const aHasPeriod = a.selectedPeriodActualMinutes > 0 || a.selectedPeriodPlannedMinutes > 0;
        const bHasPeriod = b.selectedPeriodActualMinutes > 0 || b.selectedPeriodPlannedMinutes > 0;
        if (aHasPeriod !== bHasPeriod) return aHasPeriod ? -1 : 1;
        if (b.selectedPeriodActualMinutes !== a.selectedPeriodActualMinutes) {
          return b.selectedPeriodActualMinutes - a.selectedPeriodActualMinutes;
        }
        return b.lifetimeActualMinutes - a.lifetimeActualMinutes;
      });

      // 9. Build Sessions Summary
      const periodDurationMinutes = validPeriodSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
      const activeDaysSet = new Set(validPeriodSessions.map((s) => s.startedAt.split('T')[0]));

      // Sort sessions descending by start time
      const sortedPeriodSessions = [...validPeriodSessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      const recentSessions: ReportSessionItem[] = sortedPeriodSessions.slice(0, 15).map((s) => {
        const task = taskMap.get(s.taskId);
        const roadmap = task?.roadmapId ? roadmapMap.get(task.roadmapId) : undefined;
        return {
          id: s.id,
          startedAt: s.startedAt,
          durationMinutes: s.durationMinutes,
          taskId: s.taskId,
          taskTitle: task?.title ?? 'Unknown Task',
          roadmapTitle: roadmap?.title,
        };
      });

      const sessionsSummary: ReportSessionsSummary = {
        totalSessionsCount: validPeriodSessions.length,
        totalDurationMinutes: periodDurationMinutes,
        activeDaysCount: activeDaysSet.size,
        recentSessions,
      };

      // 10. Build Weekly Planning Summary
      const plannedDurationMinutes = plannedCommitments.reduce((sum, item) => sum + item.plannedMinutes, 0);
      const datedCommitmentsCount = plannedCommitments.filter((item) => !!item.targetDate).length;
      const flexibleCommitmentsCount = plannedCommitments.filter((item) => !item.targetDate).length;
      const completedCommitmentsCount = plannedCommitments.filter((item) => item.isCompleted).length;

      const planningActiveDaysSet = new Set<string>();
      for (const item of plannedCommitments) {
        if (item.targetDate) planningActiveDaysSet.add(item.targetDate);
      }
      for (const d of activeDaysSet) {
        planningActiveDaysSet.add(d);
      }

      const weeklyPlanning: ReportWeeklyPlanningSummary = {
        plannedCommitmentsCount: plannedCommitments.length,
        completedCommitmentsCount,
        totalPlannedMinutes: plannedDurationMinutes,
        datedCommitmentsCount,
        flexibleCommitmentsCount,
        activeDaysCount: planningActiveDaysSet.size,
        commitments: plannedCommitments.map((item) => {
          const task = taskMap.get(item.taskId);
          const roadmap = task?.roadmapId ? roadmapMap.get(task.roadmapId) : undefined;
          return {
            id: item.id,
            taskId: item.taskId,
            taskTitle: task?.title ?? 'Unknown Task',
            roadmapTitle: roadmap?.title ?? 'General',
            plannedMinutes: item.plannedMinutes,
            targetDate: item.targetDate,
            isCompleted: item.isCompleted,
          };
        }),
      };

      // 11. Build Daily Activity Breakdown
      const dates = getDatesInRange({ startDate, endDate });
      const dailyActivity: ReportDailyActivityItem[] = dates.map((dateStr) => {
        const dayDate = new Date(`${dateStr}T12:00:00.000Z`);
        const dayOfWeek = dayDate.getUTCDay() === 0 ? 7 : dayDate.getUTCDay();

        const daySessions = validPeriodSessions.filter((s) => s.startedAt.startsWith(dateStr));
        const actualMinutes = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        const dayTaskIds = new Set(daySessions.map((s) => s.taskId));

        let plannedMinutes = 0;
        for (const item of plannedCommitments) {
          if (item.targetDate === dateStr) {
            plannedMinutes += item.plannedMinutes;
          }
        }

        const tasksCompletedCount = allTasks.filter(
          (t) => targetTaskIds.has(t.id) && t.status === 'completed' && t.updatedAt?.startsWith(dateStr)
        ).length;

        return {
          date: dateStr,
          dayOfWeek,
          plannedMinutes,
          actualMinutes,
          sessionCount: daySessions.length,
          tasksWorkedOnCount: dayTaskIds.size,
          tasksCompletedCount,
        };
      });

      // 12. Build Overview
      const activeGoalsCount = targetGoals.filter(
        (g) => g.status === 'in_progress' || g.status === 'not_started'
      ).length;
      const activeRoadmapsCount = targetRoadmaps.filter((r) => {
        const rTasks = allTasks.filter((t) => t.roadmapId === r.id);
        const allDone = rTasks.length > 0 && rTasks.every((t) => t.status === 'completed');
        return !allDone;
      }).length;
      const tasksWorkedOnCount = taskPeriodSessionsMap.size;
      const tasksCompletedCount = targetTasks.filter((t) => t.status === 'completed').length;

      const plannedMinutes = plannedDurationMinutes;
      const actualMinutes = periodDurationMinutes;
      const varianceMinutes = actualMinutes - plannedMinutes;
      const timeCompletionPercentage =
        plannedMinutes > 0 ? Math.round((actualMinutes / plannedMinutes) * 100) : 0;

      const overview: ReportOverview = {
        activeGoalsCount,
        activeRoadmapsCount,
        tasksWorkedOnCount,
        tasksCompletedCount,
        totalTasksCount: targetTasks.length,
        plannedMinutes,
        actualMinutes,
        varianceMinutes,
        timeCompletionPercentage,
        sessionCount: validPeriodSessions.length,
        plannedCommitmentsCount: plannedCommitments.length,
        completedCommitmentsCount,
      };

      // 13. Construct Metadata
      const metadata: ReportMetadata = {
        title: options.title?.trim() || 'PathFlow Official Progress Report',
        generatedAt: new Date().toISOString(),
        reviewPeriod: {
          type: periodReview.period.type,
          startDate,
          endDate,
          weekIdentifier,
          label,
        },
        language: options.language ?? 'en',
        calendar: options.calendar ?? 'gregorian',
        scope,
      };

      return {
        metadata,
        overview,
        goals: reportGoals,
        roadmaps: reportRoadmaps,
        tasks: reportTasks,
        sessionsSummary,
        weeklyPlanning,
        dailyActivity,
      };
    } catch (err) {
      handleRepositoryError(err, 'Failed to generate official progress report.');
    }
  }
}
