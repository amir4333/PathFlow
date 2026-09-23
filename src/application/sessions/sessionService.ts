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
  isValidDateString,
  isValidWeekIdentifier,
} from '../../domain';
import { SessionRepository, TaskRepository } from '../../data/repositories/interfaces';
import {
  ValidationError,
  NotFoundError,
  ActiveSessionConflictError,
  ApplicationError,
  handleRepositoryError,
} from '../errors';
import { CreateManualSessionInput } from '../types';

export class SessionService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly taskRepo: TaskRepository
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

    const task = await this.taskRepo.getById(input.taskId);
    if (!task) {
      throw new NotFoundError('Task', input.taskId);
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
}
