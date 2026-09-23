/**
 * Progress & Review Application Service
 *
 * Orchestrates progress retrieval across arbitrary Horizons (Day, Week, Range,
 * Roadmap, Goal, Project History, and Teacher/Student Reviews).
 *
 * Adheres strictly to the architectural invariant:
 * - Collects primary domain entities from Repositories (Task, Session, WeeklyPlan, Roadmap, Goal).
 * - Forwards data directly into pure domain calculation services in src/domain/services/.
 * - Never stores or mutates redundant "Progress" state in IndexedDB.
 */

import {
  EntityId,
  DailyProgressSummary,
  WeeklyReviewSummary,
  RoadmapDetailedProgress,
  GoalDetailedProgress,
  ProjectHistorySnapshot,
  ProgressReviewReport,
  DateRange,
  ProgressTimePoint,
  DateActivityItem,
  TaskActivityItem,
  PeriodSpecification,
  ComprehensivePeriodReview,
  calculateComprehensivePeriodReview,
  calculateDailyProgressSummary,
  calculateWeeklyReviewSummary,
  calculateDetailedRoadmapProgress,
  calculateDetailedGoalProgress,
  calculateProgressOverTime,
  aggregateActivityByDate,
  aggregateActivityByTask,
  reconstructProjectHistory,
  generateProgressReviewReport,
  getWeekIdentifier,
  getThisWeekPeriod,
  getPreviousWeekPeriod,
  getWeekPeriod,
  getLastNDaysPeriod,
  isValidDateString,
  isValidWeekIdentifier,
  createTimestamp,
} from '../../domain';
import {
  GoalRepository,
  RoadmapRepository,
  TaskRepository,
  SessionRepository,
  WeeklyPlanRepository,
} from '../../data/repositories/interfaces';
import {
  ValidationError,
  NotFoundError,
  handleRepositoryError,
} from '../errors';

export class ProgressService {
  constructor(
    private readonly goalRepo: GoalRepository,
    private readonly roadmapRepo: RoadmapRepository,
    private readonly taskRepo: TaskRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly weeklyPlanRepo: WeeklyPlanRepository
  ) {}

  /**
   * Derives a Daily Progress Summary for any given calendar date (YYYY-MM-DD).
   * Defaults to today's date if omitted.
   */
  async getDailyProgress(date?: string): Promise<DailyProgressSummary> {
    const targetDate = (date ? date.trim().split('T')[0] : new Date().toISOString().split('T')[0]);
    if (!isValidDateString(targetDate)) {
      throw new ValidationError([`Invalid calendar date: "${date}". Format must be YYYY-MM-DD.`]);
    }

    try {
      const [sessions, tasks, weeklyPlans] = await Promise.all([
        this.sessionRepo.getByDate(targetDate),
        this.taskRepo.getAll(),
        this.weeklyPlanRepo.getAll(),
      ]);

      return calculateDailyProgressSummary(
        targetDate,
        sessions,
        tasks,
        weeklyPlans
      );
    } catch (err) {
      handleRepositoryError(err, `Failed to derive daily progress for date "${targetDate}".`);
    }
  }

  /**
   * Derives a Weekly Review Summary for any given ISO week (YYYY-Www).
   * Defaults to current ISO week if omitted.
   */
  async getWeeklyProgress(weekIdentifier?: string): Promise<WeeklyReviewSummary> {
    const targetWeek = (weekIdentifier ? weekIdentifier.trim() : getWeekIdentifier(new Date()));
    if (!isValidWeekIdentifier(targetWeek)) {
      throw new ValidationError([
        `Invalid ISO week identifier: "${weekIdentifier}". Format must be YYYY-Www.`,
      ]);
    }

    try {
      const [sessions, plan, tasks, roadmaps, goals] = await Promise.all([
        this.sessionRepo.getByWeek(targetWeek),
        this.weeklyPlanRepo.getByWeekIdentifier(targetWeek),
        this.taskRepo.getAll(),
        this.roadmapRepo.getAll(),
        this.goalRepo.getAll(),
      ]);

      return calculateWeeklyReviewSummary(
        targetWeek,
        sessions,
        tasks,
        roadmaps,
        goals,
        plan
      );
    } catch (err) {
      handleRepositoryError(err, `Failed to derive weekly review for week "${targetWeek}".`);
    }
  }

  /**
   * Derives progress over time across an arbitrary calendar date range.
   */
  async getProgressForDateRange(range: DateRange): Promise<{
    readonly range: DateRange;
    readonly timeSeries: readonly ProgressTimePoint[];
    readonly activityByDate: readonly DateActivityItem[];
    readonly activityByTask: readonly TaskActivityItem[];
    readonly totalActualMinutes: number;
    readonly totalPlannedMinutes: number;
    readonly totalVarianceMinutes: number;
  }> {
    if (!isValidDateString(range.startDate) || !isValidDateString(range.endDate)) {
      throw new ValidationError(['Start date and end date must be valid YYYY-MM-DD calendar dates.']);
    }
    if (range.startDate > range.endDate) {
      throw new ValidationError([
        `Start date "${range.startDate}" cannot follow end date "${range.endDate}".`,
      ]);
    }

    try {
      const [sessions, weeklyPlans, tasks] = await Promise.all([
        this.sessionRepo.getByDateRange(range.startDate, range.endDate),
        this.weeklyPlanRepo.getAll(),
        this.taskRepo.getAll(),
      ]);

      const timeSeries = calculateProgressOverTime({
        range,
        sessions,
        weeklyPlans,
        tasks,
      });

      const activityByDate = aggregateActivityByDate(sessions, range);
      const activityByTask = aggregateActivityByTask(sessions, tasks);

      const totalActualMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
      const totalPlannedMinutes = timeSeries.reduce((sum, pt) => sum + pt.plannedMinutes, 0);
      const totalVarianceMinutes = totalActualMinutes - totalPlannedMinutes;

      return {
        range,
        timeSeries,
        activityByDate,
        activityByTask,
        totalActualMinutes,
        totalPlannedMinutes,
        totalVarianceMinutes,
      };
    } catch (err) {
      handleRepositoryError(err, 'Failed to derive progress for date range.');
    }
  }

  /**
   * Derives detailed hierarchical progress for a specific Roadmap.
   */
  async getRoadmapProgress(roadmapId: EntityId): Promise<RoadmapDetailedProgress> {
    let roadmap = await this.roadmapRepo.getById(roadmapId);
    if (!roadmap) {
      throw new NotFoundError('Roadmap', roadmapId);
    }

    try {
      const [tasks, sessions, weeklyPlans] = await Promise.all([
        this.taskRepo.getByRoadmapId(roadmapId),
        this.sessionRepo.getAll(),
        this.weeklyPlanRepo.getAll(),
      ]);

      // Filter sessions relevant to this roadmap's tasks
      const taskIds = new Set(tasks.map((t) => t.id));
      const relevantSessions = sessions.filter((s) => taskIds.has(s.taskId));

      return calculateDetailedRoadmapProgress(
        roadmap,
        tasks,
        relevantSessions,
        weeklyPlans
      );
    } catch (err) {
      handleRepositoryError(err, `Failed to derive progress for Roadmap "${roadmapId}".`);
    }
  }

  /**
   * Derives detailed hierarchical progress for a specific Goal.
   */
  async getGoalProgress(goalId: EntityId): Promise<GoalDetailedProgress> {
    const goal = await this.goalRepo.getById(goalId);
    if (!goal) {
      throw new NotFoundError('Goal', goalId);
    }

    try {
      const [roadmaps, allTasks, allSessions, weeklyPlans] = await Promise.all([
        this.roadmapRepo.getByGoalId(goalId),
        this.taskRepo.getAll(),
        this.sessionRepo.getAll(),
        this.weeklyPlanRepo.getAll(),
      ]);

      const roadmapIds = new Set(roadmaps.map((r) => r.id));
      const relevantTasks = allTasks.filter((t) => roadmapIds.has(t.roadmapId));
      const taskIds = new Set(relevantTasks.map((t) => t.id));
      const relevantSessions = allSessions.filter((s) => taskIds.has(s.taskId));

      return calculateDetailedGoalProgress(
        goal,
        roadmaps,
        relevantTasks,
        relevantSessions,
        weeklyPlans
      );
    } catch (err) {
      handleRepositoryError(err, `Failed to derive progress for Goal "${goalId}".`);
    }
  }

  /**
   * Reconstructs historical project status as of an arbitrary historical timestamp.
   */
  async getProjectHistory(asOfDate?: string): Promise<ProjectHistorySnapshot> {
    if (asOfDate !== undefined && !isValidDateString(asOfDate)) {
      throw new ValidationError([`Invalid asOfDate format: "${asOfDate}". Expected YYYY-MM-DD.`]);
    }

    try {
      const [goals, roadmaps, tasks, sessions] = await Promise.all([
        this.goalRepo.getAll(),
        this.roadmapRepo.getAll(),
        this.taskRepo.getAll(),
        this.sessionRepo.getAll(),
      ]);

      return reconstructProjectHistory({
        goals,
        roadmaps,
        tasks,
        sessions,
        asOfDate,
      });
    } catch (err) {
      handleRepositoryError(err, 'Failed to reconstruct project history.');
    }
  }

  /**
   * Generates a comprehensive ProgressReviewReport for teacher reviews or student self-analysis.
   */
  async getProgressReviewReport(options?: {
    readonly range?: DateRange;
    readonly recentWeeksCount?: number;
  }): Promise<ProgressReviewReport> {
    const period = options?.range ?? getLastNDaysPeriod(30);

    try {
      const [goals, roadmaps, tasks, sessions, weeklyPlans] = await Promise.all([
        this.goalRepo.getAll(),
        this.roadmapRepo.getAll(),
        this.taskRepo.getAll(),
        this.sessionRepo.getAll(),
        this.weeklyPlanRepo.getAll(),
      ]);

      return generateProgressReviewReport({
        period,
        goals,
        roadmaps,
        tasks,
        sessions,
        weeklyPlans,
      });
    } catch (err) {
      handleRepositoryError(err, 'Failed to generate progress review report.');
    }
  }

  /**
   * Derives a Comprehensive Period Review for Phase 11A.
   * Supports 'this-week', 'last-week', and arbitrary 'custom' date ranges.
   */
  async getPeriodProgressReview(options: {
    readonly periodType: 'this-week' | 'last-week' | 'custom';
    readonly customStartDate?: string;
    readonly customEndDate?: string;
    readonly referenceDate?: Date | string;
  }): Promise<ComprehensivePeriodReview> {
    const ref = options.referenceDate !== undefined ? new Date(options.referenceDate) : new Date();

    let period: PeriodSpecification;

    if (options.periodType === 'this-week') {
      const weekId = getWeekIdentifier(ref);
      const weekRange = getWeekPeriod(weekId);
      period = {
        type: 'this-week',
        startDate: weekRange.startDate,
        endDate: weekRange.endDate,
        weekIdentifier: weekId,
        label: `This Week (${weekId})`,
      };
    } else if (options.periodType === 'last-week') {
      const prevWeekDate = new Date(ref.getTime() - 7 * 24 * 3600 * 1000);
      const prevWeekId = getWeekIdentifier(prevWeekDate);
      const prevWeekRange = getWeekPeriod(prevWeekId);
      period = {
        type: 'last-week',
        startDate: prevWeekRange.startDate,
        endDate: prevWeekRange.endDate,
        weekIdentifier: prevWeekId,
        label: `Last Week (${prevWeekId})`,
      };
    } else {
      // Custom range
      const startDate = options.customStartDate?.trim() ?? getLastNDaysPeriod(7, ref).startDate;
      const endDate = options.customEndDate?.trim() ?? getLastNDaysPeriod(7, ref).endDate;

      if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
        throw new ValidationError(['Start date and end date must be valid YYYY-MM-DD calendar dates.']);
      }
      if (startDate > endDate) {
        throw new ValidationError([
          `Start date "${startDate}" cannot follow end date "${endDate}".`,
        ]);
      }

      period = {
        type: 'custom',
        startDate,
        endDate,
        label: `Custom Range (${startDate} – ${endDate})`,
      };
    }

    try {
      const [sessions, tasks, roadmaps, goals, weeklyPlans] = await Promise.all([
        this.sessionRepo.getAll(),
        this.taskRepo.getAll(),
        this.roadmapRepo.getAll(),
        this.goalRepo.getAll(),
        this.weeklyPlanRepo.getAll(),
      ]);

      return calculateComprehensivePeriodReview({
        period,
        sessions,
        tasks,
        roadmaps,
        goals,
        weeklyPlans,
      });
    } catch (err) {
      handleRepositoryError(err, 'Failed to derive comprehensive period progress review.');
    }
  }
}

