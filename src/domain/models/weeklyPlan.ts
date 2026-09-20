/**
 * Weekly Plan Entity
 *
 * Represents tactical commitment and capacity allocation for a specific week.
 * Contains planned items referencing existing Tasks by taskId without duplicating Task data.
 */

import { EntityId, Timestamp, generateEntityId, createTimestamp } from '../common/types';

export interface WeeklyPlanItem {
  readonly id: EntityId;
  readonly weeklyPlanId: EntityId;
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
  /** Total target duration for the week in minutes */
  readonly targetMinutes: number;
  readonly items: readonly WeeklyPlanItem[];
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface CreateWeeklyPlanItemParams {
  id?: EntityId;
  weeklyPlanId?: EntityId;
  taskId: EntityId;
  targetDate: string;
  plannedMinutes: number;
  isCompleted?: boolean;
}

export function createWeeklyPlanItem(params: CreateWeeklyPlanItemParams): WeeklyPlanItem {
  return {
    id: params.id ?? generateEntityId(),
    weeklyPlanId: params.weeklyPlanId ?? generateEntityId(),
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
  targetMinutes?: number;
  items?: readonly WeeklyPlanItem[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function createWeeklyPlan(params: CreateWeeklyPlanParams): WeeklyPlan {
  const now = createTimestamp();
  const weekIdentifier = params.weekIdentifier.trim();
  const title = params.title ? params.title.trim() : `Plan for ${weekIdentifier}`;
  const planId = params.id ?? generateEntityId();
  const targetMinutes = Math.max(0, Math.round(params.targetMinutes ?? 0));

  // Ensure any attached items are associated with this plan ID if not already set
  const items = (params.items ?? []).map((item) => {
    if (!item.weeklyPlanId || item.weeklyPlanId !== planId) {
      return { ...item, weeklyPlanId: planId };
    }
    return item;
  });

  return {
    id: planId,
    weekIdentifier,
    title,
    targetMinutes,
    items,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? params.createdAt ?? now,
  };
}
