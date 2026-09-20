/**
 * Dexie Session Repository Implementation
 */

import { EntityId, Session, validateSession } from '../../../domain';
import { PathFlowDB } from '../../local/database';
import { SessionRepository } from '../interfaces/sessionRepository';
import {
  DomainValidationError,
  EntityNotFoundError,
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
}
