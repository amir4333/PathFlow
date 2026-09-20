/**
 * Session Entity & Active Session Model
 *
 * Represents an actual discrete period of deep work executed by the user.
 * An activity record referencing its associated Task, preserving historical execution.
 *
 * Distinguishes between:
 * - ActiveSession: currently running timer on the device (at most one at a time)
 * - Session: completed immutable historical record with computed duration
 */

import {
  EntityId,
  Timestamp,
  generateEntityId,
  createTimestamp,
  calculateDurationMinutes,
} from '../common/types';

/**
 * Represents an active, currently running work session.
 * Stores minimal state (start timestamp) and derives elapsed time on demand.
 */
export interface ActiveSession {
  readonly id: EntityId;
  readonly taskId: EntityId;
  readonly startedAt: Timestamp;
}

/**
 * Completed historical work session.
 */
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
 * Starts a new active work session for a given task.
 */
export function startActiveSession(
  taskId: EntityId,
  startedAt?: Timestamp,
  id?: EntityId
): ActiveSession {
  return {
    id: id ?? generateEntityId(),
    taskId,
    startedAt: startedAt ?? createTimestamp(),
  };
}

/**
 * Derives current elapsed duration in whole minutes for an active session.
 */
export function calculateActiveSessionElapsedMinutes(
  activeSession: ActiveSession,
  asOf?: Timestamp
): number {
  const currentTimestamp = asOf ?? createTimestamp();
  return calculateDurationMinutes(activeSession.startedAt, currentTimestamp);
}

/**
 * Derives current elapsed duration in whole seconds for an active session (useful for UI timers).
 */
export function calculateActiveSessionElapsedSeconds(
  activeSession: ActiveSession,
  asOf?: Timestamp
): number {
  const currentTimestamp = asOf ?? createTimestamp();
  const startMs = Date.parse(activeSession.startedAt);
  const currentMs = Date.parse(currentTimestamp);
  if (isNaN(startMs) || isNaN(currentMs)) {
    return 0;
  }
  return Math.max(0, Math.floor((currentMs - startMs) / 1000));
}

/**
 * Completes an active session, calculating durationMinutes and returning a historical Session entity.
 */
export function completeActiveSession(
  activeSession: ActiveSession,
  endedAt?: Timestamp
): Session {
  const finalEndedAt = endedAt ?? createTimestamp();
  const duration = calculateDurationMinutes(activeSession.startedAt, finalEndedAt);

  return {
    id: activeSession.id,
    taskId: activeSession.taskId,
    startedAt: activeSession.startedAt,
    endedAt: finalEndedAt,
    durationMinutes: duration,
  };
}

/**
 * Factory for creating a Session entity directly (used for manual session logging and imports).
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

/**
 * Alias for manual session creation, emphasizing intentional offline historical entry.
 */
export function createManualSession(params: CreateSessionParams): Session {
  return createSession(params);
}
