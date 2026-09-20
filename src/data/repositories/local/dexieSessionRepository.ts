/**
 * Dexie Session Repository Implementation
 *
 * Implements historical session persistence, temporal queries,
 * and active running session lifecycle guarantees using Dexie.js and IndexedDB.
 */

import {
  EntityId,
  Timestamp,
  Session,
  ActiveSession,
  validateSession,
  validateActiveSession,
  startActiveSession,
  completeActiveSession,
  getWeekDateRange,
  createTimestamp,
} from '../../../domain';
import { PathFlowDB } from '../../local/database';
import { SessionRepository } from '../interfaces/sessionRepository';
import {
  DomainValidationError,
  EntityNotFoundError,
  ActiveSessionConflictError,
} from '../../errors';

export class DexieSessionRepository implements SessionRepository {
  constructor(private readonly db: PathFlowDB) {}

  async create(session: Session): Promise<Session> {
    const validation = validateSession(session);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    const task = await this.db.tasks.get(session.taskId);
    if (!task) {
      throw new EntityNotFoundError(
        `Referenced Task "${session.taskId}" does not exist.`
      );
    }

    await this.db.sessions.add(session);
    return session;
  }

  async getById(id: EntityId): Promise<Session | null> {
    const session = await this.db.sessions.get(id);
    return session ?? null;
  }

  async getAll(): Promise<Session[]> {
    return await this.db.sessions.orderBy('startedAt').toArray();
  }

  async getByTaskId(taskId: EntityId): Promise<Session[]> {
    return await this.db.sessions.where('taskId').equals(taskId).sortBy('startedAt');
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Session[]> {
    const startISO = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
    const endISO = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;

    return await this.db.sessions
      .where('startedAt')
      .between(startISO, endISO, true, true)
      .toArray();
  }

  async getByDate(date: string): Promise<Session[]> {
    const cleanDate = date.trim().split('T')[0];
    return await this.getByDateRange(cleanDate, cleanDate);
  }

  async getByWeek(weekIdentifier: string): Promise<Session[]> {
    const range = getWeekDateRange(weekIdentifier);
    return await this.getByDateRange(range.startDate, range.endDate);
  }

  async update(session: Session): Promise<Session> {
    const validation = validateSession(session);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    const existing = await this.getById(session.id);
    if (!existing) {
      throw new EntityNotFoundError(`Session with ID "${session.id}" not found.`);
    }

    const task = await this.db.tasks.get(session.taskId);
    if (!task) {
      throw new EntityNotFoundError(
        `Referenced Task "${session.taskId}" does not exist.`
      );
    }

    await this.db.sessions.put(session);
    return session;
  }

  async delete(id: EntityId): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new EntityNotFoundError(`Session with ID "${id}" not found.`);
    }

    await this.db.sessions.delete(id);
  }

  // Active Session Lifecycle Management

  async getActiveSession(): Promise<ActiveSession | null> {
    const active = await this.db.activeSession.toCollection().first();
    return active ?? null;
  }

  async startActiveSession(taskId: EntityId, startedAt?: Timestamp): Promise<ActiveSession> {
    const task = await this.db.tasks.get(taskId);
    if (!task) {
      throw new EntityNotFoundError(
        `Cannot start session: referenced Task "${taskId}" does not exist.`
      );
    }

    const currentActive = await this.getActiveSession();
    if (currentActive) {
      throw new ActiveSessionConflictError(
        `An active session is already running for Task "${currentActive.taskId}". Complete or discard it before starting a new session.`,
        currentActive.taskId
      );
    }

    const active = startActiveSession(taskId, startedAt);
    const validation = validateActiveSession(active);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    await this.db.activeSession.add(active);
    return active;
  }

  async stopActiveSession(endedAt?: Timestamp): Promise<Session> {
    const active = await this.getActiveSession();
    if (!active) {
      throw new EntityNotFoundError('Cannot stop session: No active session is currently running.');
    }

    const endTimestamp = endedAt ?? createTimestamp();
    const session = completeActiveSession(active, endTimestamp);

    const validation = validateSession(session);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    // Atomic transaction: commit completed historical session and clear active state
    await this.db.transaction('rw', [this.db.sessions, this.db.activeSession], async () => {
      await this.db.sessions.add(session);
      await this.db.activeSession.clear();
    });

    return session;
  }

  async discardActiveSession(): Promise<void> {
    await this.db.activeSession.clear();
  }
}
