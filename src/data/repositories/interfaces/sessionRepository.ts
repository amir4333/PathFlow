import { EntityId, Session } from '../../../domain';

export interface SessionRepository {
  create(session: Session): Promise<Session>;
  getById(id: EntityId): Promise<Session | null>;
  getByTaskId(taskId: EntityId): Promise<Session[]>;
  getByDateRange(startDate: string, endDate: string): Promise<Session[]>;
  update(session: Session): Promise<Session>;
  delete(id: EntityId): Promise<void>;
}
