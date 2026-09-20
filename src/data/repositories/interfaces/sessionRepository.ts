import { EntityId, Timestamp, Session, ActiveSession } from '../../../domain';

export interface SessionRepository {
  // Core CRUD
  create(session: Session): Promise<Session>;
  getById(id: EntityId): Promise<Session | null>;
  getAll(): Promise<Session[]>;
  getByTaskId(taskId: EntityId): Promise<Session[]>;
  getByDateRange(startDate: string, endDate: string): Promise<Session[]>;
  getByDate(date: string): Promise<Session[]>;
  getByWeek(weekIdentifier: string): Promise<Session[]>;
  update(session: Session): Promise<Session>;
  delete(id: EntityId): Promise<void>;

  // Active Session Lifecycle
  getActiveSession(): Promise<ActiveSession | null>;
  startActiveSession(taskId: EntityId, startedAt?: Timestamp): Promise<ActiveSession>;
  stopActiveSession(endedAt?: Timestamp): Promise<Session>;
  discardActiveSession(): Promise<void>;
}
