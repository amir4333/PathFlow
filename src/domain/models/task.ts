/**
 * Task Entity
 *
 * Represents an actionable unit of work linked directly to a Roadmap milestone.
 * Status and priority are governed by controlled union types.
 */

import { EntityId, Timestamp, generateEntityId, createTimestamp } from '../common/types';

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

export const TASK_STATUSES: readonly TaskStatus[] = [
  'todo',
  'in_progress',
  'completed',
  'blocked',
  'cancelled',
] as const;

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const TASK_PRIORITIES: readonly TaskPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
] as const;

export interface Task {
  readonly id: EntityId;
  readonly roadmapId: EntityId;
  readonly title: string;
  readonly description: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly estimatedMinutes: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly completedAt?: Timestamp;
}

export interface CreateTaskParams {
  id?: EntityId;
  roadmapId: EntityId;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;
}

/**
 * Factory for creating a Task entity.
 * Automatically synchronizes completedAt when status is 'completed'.
 */
export function createTask(params: CreateTaskParams): Task {
  const now = createTimestamp();
  const title = params.title ? params.title.trim() : '';
  const status = params.status ?? 'todo';
  const estimatedMinutes = Math.max(0, params.estimatedMinutes ?? 0);

  let completedAt = params.completedAt;
  if (status === 'completed' && !completedAt) {
    completedAt = params.updatedAt ?? now;
  } else if (status !== 'completed') {
    completedAt = undefined;
  }

  return {
    id: params.id ?? generateEntityId(),
    roadmapId: params.roadmapId,
    title,
    description: (params.description ?? '').trim(),
    status,
    priority: params.priority ?? 'medium',
    estimatedMinutes,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? params.createdAt ?? now,
    completedAt,
  };
}
