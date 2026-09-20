/**
 * Session Entity
 *
 * Represents an actual discrete period of deep work executed by the user.
 * An activity record referencing its associated Task, not a container owning the Task.
 * Does not store redundant derived progress metrics.
 */

import {
  EntityId,
  Timestamp,
  generateEntityId,
  calculateDurationMinutes,
} from '../common/types';

export interface Session {
  readonly id: EntityId;
  readonly taskId: EntityId;
  readonly startedAt: Timestamp;
  readonly endedAt: Timestamp;
  readonly durationMinutes: number;
}

export interface CreateSessionParams {
  id?: EntityId;
  taskId: EntityId;
  startedAt: Timestamp;
  endedAt: Timestamp;
  durationMinutes?: number;
}

/**
 * Factory for creating a Session entity.
 * Calculates durationMinutes automatically from startedAt and endedAt if not explicitly provided.
 */
export function createSession(params: CreateSessionParams): Session {
  const duration =
    params.durationMinutes !== undefined
      ? Math.max(0, Math.round(params.durationMinutes))
      : calculateDurationMinutes(params.startedAt, params.endedAt);

  return {
    id: params.id ?? generateEntityId(),
    taskId: params.taskId,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    durationMinutes: duration,
  };
}
