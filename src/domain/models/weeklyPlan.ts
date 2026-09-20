/**
 * Weekly Plan Entity
 *
 * Represents tactical commitment and capacity allocation for a specific week.
 * Contains planned items referencing existing Tasks by taskId without duplicating Task data.
 */

import { EntityId, Timestamp, generateEntityId, createTimestamp } from '../common/types';

export interface WeeklyPlanItem {
  readonly id: EntityId;
  readonly taskId: EntityId;
  /** ISO date string for the target day, e.g., "2026-09-21" */
  readonly targetDate: string;
  readonly plannedMinutes: number;
  readonly isCompleted: boolean;
}

export interface WeeklyPlan {
  readonly id: EntityId;
  /** ISO week identifier (e.g., "2026-W38") */
  readonly weekIdentifier: string;
  readonly title: string;
  readonly items: readonly WeeklyPlanItem[];
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface CreateWeeklyPlanItemParams {
  id?: EntityId;
  taskId: EntityId;
  targetDate: string;
  plannedMinutes: number;
  isCompleted?: boolean;
}

export function createWeeklyPlanItem(params: CreateWeeklyPlanItemParams): WeeklyPlanItem {
  return {
    id: params.id ?? generateEntityId(),
    taskId: params.taskId,
    targetDate: params.targetDate.trim(),
    plannedMinutes: Math.max(0, Math.round(params.plannedMinutes)),
    isCompleted: params.isCompleted ?? false,
  };
}

export interface CreateWeeklyPlanParams {
  id?: EntityId;
  weekIdentifier: string;
  title?: string;
  items?: readonly WeeklyPlanItem[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function createWeeklyPlan(params: CreateWeeklyPlanParams): WeeklyPlan {
  const now = createTimestamp();
  const weekIdentifier = params.weekIdentifier.trim();
  const title = params.title ? params.title.trim() : `Plan for ${weekIdentifier}`;

  return {
    id: params.id ?? generateEntityId(),
    weekIdentifier,
    title,
    items: params.items ?? [],
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? params.createdAt ?? now,
  };
}
