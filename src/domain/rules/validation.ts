/**
 * Domain Validation Rules
 *
 * Explicit, testable invariant checks for core PathFlow entities.
 * Pure TypeScript functions with no external framework dependencies.
 */

import { isValidEntityId, isValidTimestamp } from '../common/types';
import { Goal, GOAL_STATUSES } from '../models/goal';
import { Roadmap } from '../models/roadmap';
import { Task, TASK_STATUSES, TASK_PRIORITIES } from '../models/task';
import { Session } from '../models/session';
import { WeeklyPlan, WeeklyPlanItem } from '../models/weeklyPlan';

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

function createSuccessResult(): ValidationResult {
  return { isValid: true, errors: [] };
}

function createErrorResult(errors: string[]): ValidationResult {
  return { isValid: false, errors };
}

/**
 * Validates a Goal entity according to domain rules.
 */
export function validateGoal(goal: Goal): ValidationResult {
  const errors: string[] = [];

  if (!isValidEntityId(goal.id)) {
    errors.push('Goal ID must be a valid non-empty identifier.');
  }

  if (!goal.title || goal.title.trim().length === 0) {
    errors.push('Goal title is required and cannot be empty.');
  }

  if (!GOAL_STATUSES.includes(goal.status)) {
    errors.push(`Invalid Goal status: "${goal.status}". Expected one of: ${GOAL_STATUSES.join(', ')}.`);
  }

  if (!isValidTimestamp(goal.createdAt)) {
    errors.push('Goal createdAt must be a valid ISO timestamp.');
  }

  if (!isValidTimestamp(goal.updatedAt)) {
    errors.push('Goal updatedAt must be a valid ISO timestamp.');
  }

  return errors.length === 0 ? createSuccessResult() : createErrorResult(errors);
}

/**
 * Validates a Roadmap entity according to domain rules.
 */
export function validateRoadmap(roadmap: Roadmap): ValidationResult {
  const errors: string[] = [];

  if (!isValidEntityId(roadmap.id)) {
    errors.push('Roadmap ID must be a valid non-empty identifier.');
  }

  if (!isValidEntityId(roadmap.goalId)) {
    errors.push('Roadmap must reference a valid Goal ID (goalId).');
  }

  if (!roadmap.title || roadmap.title.trim().length === 0) {
    errors.push('Roadmap title is required and cannot be empty.');
  }

  if (!isValidTimestamp(roadmap.createdAt)) {
    errors.push('Roadmap createdAt must be a valid ISO timestamp.');
  }

  if (!isValidTimestamp(roadmap.updatedAt)) {
    errors.push('Roadmap updatedAt must be a valid ISO timestamp.');
  }

  return errors.length === 0 ? createSuccessResult() : createErrorResult(errors);
}

/**
 * Validates a Task entity according to domain rules.
 */
export function validateTask(task: Task): ValidationResult {
  const errors: string[] = [];

  if (!isValidEntityId(task.id)) {
    errors.push('Task ID must be a valid non-empty identifier.');
  }

  if (!isValidEntityId(task.roadmapId)) {
    errors.push('Task must reference a valid Roadmap ID (roadmapId).');
  }

  if (!task.title || task.title.trim().length === 0) {
    errors.push('Task title is required and cannot be empty.');
  }

  if (!TASK_STATUSES.includes(task.status)) {
    errors.push(`Invalid Task status: "${task.status}". Expected one of: ${TASK_STATUSES.join(', ')}.`);
  }

  if (!TASK_PRIORITIES.includes(task.priority)) {
    errors.push(`Invalid Task priority: "${task.priority}". Expected one of: ${TASK_PRIORITIES.join(', ')}.`);
  }

  if (typeof task.estimatedMinutes !== 'number' || isNaN(task.estimatedMinutes) || task.estimatedMinutes < 0) {
    errors.push('Task estimatedMinutes must be a non-negative number.');
  }

  if (!isValidTimestamp(task.createdAt)) {
    errors.push('Task createdAt must be a valid ISO timestamp.');
  }

  if (!isValidTimestamp(task.updatedAt)) {
    errors.push('Task updatedAt must be a valid ISO timestamp.');
  }

  if (task.status === 'completed') {
    if (!task.completedAt || !isValidTimestamp(task.completedAt)) {
      errors.push('Completed Task must have a valid completedAt timestamp.');
    }
  }

  return errors.length === 0 ? createSuccessResult() : createErrorResult(errors);
}

/**
 * Validates a Session entity according to domain rules.
 */
export function validateSession(session: Session): ValidationResult {
  const errors: string[] = [];

  if (!isValidEntityId(session.id)) {
    errors.push('Session ID must be a valid non-empty identifier.');
  }

  if (!isValidEntityId(session.taskId)) {
    errors.push('Session must reference a valid Task ID (taskId).');
  }

  const isStartValid = isValidTimestamp(session.startedAt);
  const isEndValid = isValidTimestamp(session.endedAt);

  if (!isStartValid) {
    errors.push('Session startedAt must be a valid ISO timestamp.');
  }

  if (!isEndValid) {
    errors.push('Session endedAt must be a valid ISO timestamp.');
  }

  if (isStartValid && isEndValid) {
    const startMs = Date.parse(session.startedAt);
    const endMs = Date.parse(session.endedAt);
    if (endMs < startMs) {
      errors.push('Session endedAt cannot precede startedAt.');
    }
  }

  if (typeof session.durationMinutes !== 'number' || isNaN(session.durationMinutes) || session.durationMinutes < 0) {
    errors.push('Session durationMinutes cannot be negative.');
  }

  return errors.length === 0 ? createSuccessResult() : createErrorResult(errors);
}

/**
 * Validates an individual WeeklyPlanItem.
 */
export function validateWeeklyPlanItem(item: WeeklyPlanItem): ValidationResult {
  const errors: string[] = [];

  if (!isValidEntityId(item.id)) {
    errors.push('Weekly plan item ID must be a valid non-empty identifier.');
  }

  if (!isValidEntityId(item.taskId)) {
    errors.push('Weekly plan item must reference a valid Task ID (taskId).');
  }

  if (!item.targetDate || item.targetDate.trim().length === 0) {
    errors.push('Weekly plan item targetDate is required.');
  }

  if (typeof item.plannedMinutes !== 'number' || isNaN(item.plannedMinutes) || item.plannedMinutes < 0) {
    errors.push('Weekly plan item plannedMinutes cannot be negative.');
  }

  return errors.length === 0 ? createSuccessResult() : createErrorResult(errors);
}

/**
 * Validates a WeeklyPlan aggregate.
 */
export function validateWeeklyPlan(plan: WeeklyPlan): ValidationResult {
  const errors: string[] = [];

  if (!isValidEntityId(plan.id)) {
    errors.push('Weekly plan ID must be a valid non-empty identifier.');
  }

  if (!plan.weekIdentifier || plan.weekIdentifier.trim().length === 0) {
    errors.push('Weekly plan weekIdentifier is required (e.g., "2026-W38").');
  }

  if (!isValidTimestamp(plan.createdAt)) {
    errors.push('Weekly plan createdAt must be a valid ISO timestamp.');
  }

  if (!isValidTimestamp(plan.updatedAt)) {
    errors.push('Weekly plan updatedAt must be a valid ISO timestamp.');
  }

  plan.items.forEach((item, index) => {
    const itemResult = validateWeeklyPlanItem(item);
    if (!itemResult.isValid) {
      errors.push(`Item at index ${index} is invalid: ${itemResult.errors.join('; ')}`);
    }
  });

  return errors.length === 0 ? createSuccessResult() : createErrorResult(errors);
}
