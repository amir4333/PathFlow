/**
 * Task Status Transition Rules
 *
 * Defines explicit and testable status lifecycle transitions for Tasks.
 */

import { createTimestamp, Timestamp } from '../common/types';
import { Task, TaskStatus } from '../models/task';

/**
 * Transition graph defining allowable status transitions.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  todo: ['todo', 'in_progress', 'completed', 'blocked', 'cancelled'],
  in_progress: ['in_progress', 'todo', 'completed', 'blocked', 'cancelled'],
  blocked: ['blocked', 'todo', 'in_progress', 'cancelled'],
  completed: ['completed', 'todo', 'in_progress'],
  cancelled: ['cancelled', 'todo'],
};

/**
 * Checks if a proposed status transition is allowed.
 */
export function canTransitionTaskStatus(
  currentStatus: TaskStatus,
  targetStatus: TaskStatus
): boolean {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(targetStatus) : false;
}

/**
 * Transitions a Task to a new status, returning an updated Task.
 * Manages completedAt lifecycle:
 * - Setting target to 'completed' assigns completedAt.
 * - Moving out of 'completed' (reopening) clears completedAt.
 *
 * Throws an Error if the transition violates lifecycle rules.
 */
export function transitionTaskStatus(
  task: Task,
  targetStatus: TaskStatus,
  timestamp?: Timestamp
): Task {
  if (!canTransitionTaskStatus(task.status, targetStatus)) {
    throw new Error(
      `Illegal Task status transition from "${task.status}" to "${targetStatus}".`
    );
  }

  const now = timestamp ?? createTimestamp();

  let completedAt = task.completedAt;
  if (targetStatus === 'completed') {
    completedAt = completedAt ?? now;
  } else if (task.status === 'completed') {
    completedAt = undefined;
  }

  return {
    ...task,
    status: targetStatus,
    updatedAt: now,
    completedAt,
  };
}
