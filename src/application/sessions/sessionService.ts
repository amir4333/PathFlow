/**
 * Session & Time-Tracking Application Service
 *
 * Orchestrates real-time active sessions, manual session logging,
 * and historical session queries. Preserves the singleton Active Session constraint
 * and delegates duration arithmetic to domain services.
 */

import {
  EntityId,
  Timestamp,
  Session,
  ActiveSession,
  createSession,
  validateSession,
  isValidEntityId,
  isValidTimestamp,
  calculateDurationMinutes,
  isValidDateString,
  isValidWeekIdentifier,
} from '../../domain';
import { SessionRepository, TaskRepository, RoadmapRepository } from '../../data/repositories/interfaces';
import {
  ValidationError,
  NotFoundError,
  ActiveSessionConflictError,
  ApplicationError,
  handleRepositoryError,
} from '../errors';
import { CreateManualSessionInput } from '../types';
import { SessionHistoryFilter, SessionHistoryResult } from './types';
import { resolveDateRangeBoundaries } from './dateRangeResolution';

export class SessionService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly taskRepo: TaskRepository,
    private readonly roadmapRepo?: RoadmapRepository
  ) {}

  /**
   * Starts an active time-tracking session for a Task.
   * Enforces that only one active session can run concurrently.
   */
  async startSession(taskId: EntityId, startedAt?: Timestamp): Promise<ActiveSession> {
    if (!isValidEntityId(taskId)) {
      throw new ValidationError(['Task ID must be a valid non-empty identifier.']);
    }

    const task = await this.taskRepo.getById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    const currentActive = await this.sessionRepo.getActiveSession();
    if (currentActive) {
      throw new ActiveSessionConflictError(
        `Cannot start session for Task "${taskId}": an active session is already in progress for Task "${currentActive.taskId}".`,
        currentActive.taskId
      );
    }

    try {
      return await this.sessionRepo.startActiveSession(taskId, startedAt);
    } catch (err) {
      handleRepositoryError(err, `Failed to start active session for Task "${taskId}".`);
    }
  }

  /**
   * Retrieves the currently running active session, if any.
   */
  async getActiveSession(): Promise<ActiveSession | null> {
    try {
      return await this.sessionRepo.getActiveSession();
    } catch (err) {
      handleRepositoryError(err, 'Failed to fetch active session.');
    }
  }

  /**
   * Stops the currently running active session and records a completed historical Session.
   */
  async completeSession(endedAt?: Timestamp): Promise<Session> {
    const currentActive = await this.sessionRepo.getActiveSession();
    if (!currentActive) {
      throw new ApplicationError('Cannot complete session: no active session is currently in progress.');
    }

    try {
      return await this.sessionRepo.stopActiveSession(endedAt);
    } catch (err) {
      handleRepositoryError(err, 'Failed to complete active session.');
    }
  }

  /**
   * Discards the currently running active session without recording historical time.
   */
  async discardActiveSession(): Promise<void> {
    const currentActive = await this.sessionRepo.getActiveSession();
    if (!currentActive) {
      throw new ApplicationError('Cannot discard session: no active session is currently in progress.');
    }

    try {
      await this.sessionRepo.discardActiveSession();
    } catch (err) {
      handleRepositoryError(err, 'Failed to discard active session.');
    }
  }

  /**
   * Records a manual completed session with explicit start and end timestamps.
   */
  async createManualSession(input: CreateManualSessionInput): Promise<Session> {
    if (!isValidEntityId(input.taskId)) {
      throw new ValidationError(['Task ID must be a valid non-empty identifier.']);
    }

    const currentActive = await this.sessionRepo.getActiveSession();
    if (currentActive) {
      throw new ActiveSessionConflictError(
        `Cannot record manual session: an active session is currently in progress for Task "${currentActive.taskId}". Please complete or discard the active timer first.`,
        currentActive.taskId
      );
    }

    const task = await this.taskRepo.getById(input.taskId);
    if (!task) {
      throw new NotFoundError('Task', input.taskId);
    }

    if (!isValidTimestamp(input.startedAt) || !isValidTimestamp(input.endedAt)) {
      throw new ValidationError(['Start and end times must be valid ISO timestamps.']);
    }

    const startMs = Date.parse(input.startedAt);
    const endMs = Date.parse(input.endedAt);
    if (isNaN(startMs) || isNaN(endMs)) {
      throw new ValidationError(['Invalid date format provided for start or end time.']);
    }

    if (endMs <= startMs) {
      throw new ValidationError(['End time must be after start time.']);
    }

    const nowMs = Date.now();
    if (startMs > nowMs + 60000) {
      throw new ValidationError(['Session cannot start in the future.']);
    }

    const duration = calculateDurationMinutes(input.startedAt, input.endedAt);
    if (duration <= 0) {
      throw new ValidationError(['Session duration must be at least 1 minute.']);
    }

    const session = createSession({
      taskId: input.taskId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
    });

    const validation = validateSession(session);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.sessionRepo.create(session);
    } catch (err) {
      handleRepositoryError(err, 'Failed to create manual session.');
    }
  }

  /**
   * Lists all completed sessions recorded for a specific Task.
   */
  async listSessionsForTask(taskId: EntityId): Promise<Session[]> {
    if (!isValidEntityId(taskId)) {
      throw new ValidationError(['Task ID must be a valid non-empty identifier.']);
    }

    const task = await this.taskRepo.getById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    try {
      return await this.sessionRepo.getByTaskId(taskId);
    } catch (err) {
      handleRepositoryError(err, `Failed to list sessions for Task "${taskId}".`);
    }
  }

  /**
   * Alias for listSessionsForTask
   */
  async getSessionsForTask(taskId: EntityId): Promise<Session[]> {
    return this.listSessionsForTask(taskId);
  }

  /**
   * Lists all sessions started on a specific calendar date (YYYY-MM-DD).
   */
  async listSessionsForDate(date: string): Promise<Session[]> {
    const cleanDate = date.trim().split('T')[0];
    if (!isValidDateString(cleanDate)) {
      throw new ValidationError([`Invalid calendar date format: "${date}". Expected YYYY-MM-DD.`]);
    }

    try {
      return await this.sessionRepo.getByDate(cleanDate);
    } catch (err) {
      handleRepositoryError(err, `Failed to list sessions for date "${cleanDate}".`);
    }
  }

  /**
   * Lists all sessions falling within an ISO 8601 calendar week (YYYY-Www).
   */
  async listSessionsForWeek(weekIdentifier: string): Promise<Session[]> {
    const cleanWeek = weekIdentifier.trim();
    if (!isValidWeekIdentifier(cleanWeek)) {
      throw new ValidationError([`Invalid ISO week identifier: "${weekIdentifier}". Expected YYYY-Www.`]);
    }

    try {
      return await this.sessionRepo.getByWeek(cleanWeek);
    } catch (err) {
      handleRepositoryError(err, `Failed to list sessions for week "${cleanWeek}".`);
    }
  }

  /**
   * Lists all completed sessions recorded across the application.
   */
  async getAllSessions(): Promise<Session[]> {
    try {
      return await this.sessionRepo.getAll();
    } catch (err) {
      handleRepositoryError(err, 'Failed to list all sessions.');
    }
  }

  /**
   * Retrieves a single session by its unique ID.
   */
  async getSession(sessionId: EntityId): Promise<Session | null> {
    if (!isValidEntityId(sessionId)) {
      throw new ValidationError(['Session ID must be a valid non-empty identifier.']);
    }

    try {
      return await this.sessionRepo.getById(sessionId);
    } catch (err) {
      handleRepositoryError(err, `Failed to fetch session "${sessionId}".`);
    }
  }

  /**
   * Queries completed session history with optional multi-dimensional filtering,
   * deterministic newest-first sorting, and derived duration aggregation.
   *
   * Supported filters:
   * - startDate: optional start boundary (calendar date or timestamp)
   * - endDate: optional end boundary (calendar date or timestamp)
   * - taskId: optional task ID
   * - roadmapId: optional roadmap ID (filters to all tasks under this roadmap)
   */
  async querySessionHistory(filter: SessionHistoryFilter = {}): Promise<SessionHistoryResult> {
    // 1. Resolve date boundaries if provided
    const { startIso, endIso } = resolveDateRangeBoundaries(filter.startDate, filter.endDate);

    // 2. Validate Task filter if provided
    if (filter.taskId !== undefined) {
      if (!isValidEntityId(filter.taskId)) {
        throw new ValidationError(['Task ID filter must be a valid non-empty identifier.']);
      }
      const task = await this.taskRepo.getById(filter.taskId);
      if (!task) {
        throw new NotFoundError('Task', filter.taskId);
      }
    }

    // 3. Validate Roadmap filter if provided
    let roadmapTaskIds: Set<EntityId> | null = null;
    if (filter.roadmapId !== undefined) {
      if (!isValidEntityId(filter.roadmapId)) {
        throw new ValidationError(['Roadmap ID filter must be a valid non-empty identifier.']);
      }
      if (this.roadmapRepo) {
        const roadmap = await this.roadmapRepo.getById(filter.roadmapId);
        if (!roadmap) {
          throw new NotFoundError('Roadmap', filter.roadmapId);
        }
      }
      const tasksInRoadmap = await this.taskRepo.getByRoadmapId(filter.roadmapId);
      roadmapTaskIds = new Set(tasksInRoadmap.map((t) => t.id));

      // If both taskId and roadmapId are specified, and the task doesn't belong to the roadmap,
      // no sessions can match both constraints.
      if (filter.taskId && !roadmapTaskIds.has(filter.taskId)) {
        return {
          sessions: [],
          totalSessions: 0,
          totalMinutes: 0,
          totalHoursAndMinutes: { hours: 0, minutes: 0 },
        };
      }
    }

    // 4. Retrieve candidate sessions using repository
    let sessions: Session[];
    try {
      if (filter.taskId) {
        sessions = await this.sessionRepo.getByTaskId(filter.taskId);
      } else if (startIso && endIso) {
        sessions = await this.sessionRepo.getByDateRange(startIso, endIso);
      } else {
        sessions = await this.sessionRepo.getAll();
      }
    } catch (err) {
      handleRepositoryError(err, 'Failed to query session history.');
    }

    // 5. Apply memory filtering for all active constraints
    const filtered = sessions.filter((s) => {
      if (startIso && s.startedAt < startIso) return false;
      if (endIso && s.startedAt > endIso) return false;
      if (filter.taskId && s.taskId !== filter.taskId) return false;
      if (roadmapTaskIds !== null && !roadmapTaskIds.has(s.taskId)) return false;
      return true;
    });

    // 6. Deterministic sorting: Newest session first (startedAt descending, tie-breaker on ID)
    const sorted = [...filtered].sort((a, b) => {
      const timeDiff = Date.parse(b.startedAt) - Date.parse(a.startedAt);
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    // 7. Calculate derived aggregations
    const totalSessions = sorted.length;
    const totalMinutes = sorted.reduce((sum, s) => sum + s.durationMinutes, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
      sessions: sorted,
      totalSessions,
      totalMinutes,
      totalHoursAndMinutes: {
        hours,
        minutes,
      },
    };
  }
}
