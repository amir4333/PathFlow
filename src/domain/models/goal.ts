/**
 * Goal Entity
 *
 * Represents a high-level outcome or strategic aspiration the user intends to achieve.
 * Pure TypeScript entity decoupled from presentation and storage.
 */

import { EntityId, Timestamp, generateEntityId, createTimestamp } from '../common/types';

export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'archived';

export const GOAL_STATUSES: readonly GoalStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'archived',
] as const;

export interface Goal {
  readonly id: EntityId;
  readonly title: string;
  readonly description: string;
  readonly status: GoalStatus;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface CreateGoalParams {
  id?: EntityId;
  title: string;
  description?: string;
  status?: GoalStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Factory for creating a validated Goal entity with default values.
 */
export function createGoal(params: CreateGoalParams): Goal {
  const now = createTimestamp();
  const title = params.title ? params.title.trim() : '';

  return {
    id: params.id ?? generateEntityId(),
    title,
    description: (params.description ?? '').trim(),
    status: params.status ?? 'not_started',
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? params.createdAt ?? now,
  };
}
