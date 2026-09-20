/**
 * Roadmap Entity
 *
 * Represents a structured strategic pathway or milestone track toward a specific Goal.
 * References its parent Goal via goalId without duplicating Goal attributes.
 */

import { EntityId, Timestamp, generateEntityId, createTimestamp } from '../common/types';

export interface Roadmap {
  readonly id: EntityId;
  readonly goalId: EntityId;
  readonly title: string;
  readonly description: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface CreateRoadmapParams {
  id?: EntityId;
  goalId: EntityId;
  title: string;
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Factory for creating a Roadmap entity.
 */
export function createRoadmap(params: CreateRoadmapParams): Roadmap {
  const now = createTimestamp();
  const title = params.title ? params.title.trim() : '';

  return {
    id: params.id ?? generateEntityId(),
    goalId: params.goalId,
    title,
    description: (params.description ?? '').trim(),
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? params.createdAt ?? now,
  };
}
