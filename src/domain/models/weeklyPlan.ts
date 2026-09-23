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
  /** ISO date string for the target day, e.g., "2026-09-21". Optional for weekly-only commitments without specific daily allocation */
  readonly targetDate?: string;
  readonly plannedMinutes: number;
  readonly isCompleted: boolean;
}

export interface WeeklyPlan {
  readonly id: EntityId;
  /** ISO week identifier (e.g., "2026-W38") */
  readonly weekIdentifier: string;
  readonly title: string;
  /** Total target duration/capacity for the week in minutes */
  readonly targetMinutes: number;
  readonly items: readonly WeeklyPlanItem[];
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface CreateWeeklyPlanItemParams {
  id?: EntityId;
  weeklyPlanId?: EntityId;
  taskId: EntityId;
  /** Optional specific target date (YYYY-MM-DD). If omitted, represents a weekly-level commitment */
  targetDate?: string;
  plannedMinutes: number;
  isCompleted?: boolean;
}

export function createWeeklyPlanItem(params: CreateWeeklyPlanItemParams): WeeklyPlanItem {
  const targetDate = params.targetDate && params.targetDate.trim().length > 0
    ? params.targetDate.trim()
    : undefined;

  return {
    id: params.id ?? generateEntityId(),
    weeklyPlanId: params.weeklyPlanId ?? generateEntityId(),
    taskId: params.taskId,
    ...(targetDate ? { targetDate } : {}),
    plannedMinutes: Math.max(0, Math.round(params.plannedMinutes)),
    isCompleted: params.isCompleted ?? false,
  };
}

export interface CreateWeeklyPlanParams {
  id?: EntityId;
  weekIdentifier: string;
  title?: string;
  targetMinutes?: number;
  items?: readonly (WeeklyPlanItem | CreateWeeklyPlanItemParams)[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function createWeeklyPlan(params: CreateWeeklyPlanParams): WeeklyPlan {
  const now = createTimestamp();
  const weekIdentifier = params.weekIdentifier.trim();
  const title = params.title && params.title.trim().length > 0
    ? params.title.trim()
    : `Plan for ${weekIdentifier}`;
  const planId = params.id ?? generateEntityId();

  // Ensure any attached items are associated with this plan ID if not already set
  const items: WeeklyPlanItem[] = (params.items ?? []).map((item) => {
    return createWeeklyPlanItem({
      ...item,
      weeklyPlanId: planId,
    });
  });

  // If targetMinutes is explicitly provided, use it.
  // Otherwise, default to the sum of planned item minutes if items are provided, or 0.
  const itemsTotal = items.reduce((sum, item) => sum + item.plannedMinutes, 0);
  const targetMinutes = params.targetMinutes !== undefined
    ? Math.max(0, Math.round(params.targetMinutes))
    : itemsTotal;

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

export interface UpdateWeeklyPlanParams {
  title?: string;
  targetMinutes?: number;
  items?: readonly WeeklyPlanItem[];
}

/**
 * Pure function to produce an updated WeeklyPlan while preserving original creation timestamp.
 */
export function updateWeeklyPlan(plan: WeeklyPlan, updates: UpdateWeeklyPlanParams): WeeklyPlan {
  const now = createTimestamp();
  const title = updates.title !== undefined && updates.title.trim().length > 0
    ? updates.title.trim()
    : plan.title;
  const targetMinutes = updates.targetMinutes !== undefined
    ? Math.max(0, Math.round(updates.targetMinutes))
    : plan.targetMinutes;

  let items = plan.items;
  if (updates.items !== undefined) {
    items = updates.items.map((item) => ({
      ...item,
      weeklyPlanId: plan.id,
      id: item.id && item.id.trim().length > 0 ? item.id : generateEntityId(),
    }));
  }

  return {
    ...plan,
    title,
    targetMinutes,
    items,
    updatedAt: now,
  };
}

/**
 * Pure functional helper to append a planned item to an existing plan.
 */
export function addWeeklyPlanItem(plan: WeeklyPlan, itemParams: CreateWeeklyPlanItemParams): WeeklyPlan {
  const newItem = createWeeklyPlanItem({
    ...itemParams,
    weeklyPlanId: plan.id,
  });
  return updateWeeklyPlan(plan, {
    items: [...plan.items, newItem],
  });
}

/**
 * Pure functional helper to remove a planned item from an existing plan.
 */
export function removeWeeklyPlanItem(plan: WeeklyPlan, itemId: EntityId): WeeklyPlan {
  return updateWeeklyPlan(plan, {
    items: plan.items.filter((item) => item.id !== itemId),
  });
}

/**
 * Pure functional helper to toggle the completed state of a planned item.
 */
export function toggleWeeklyPlanItemCompletion(
  plan: WeeklyPlan,
  itemId: EntityId,
  isCompleted?: boolean
): WeeklyPlan {
  return updateWeeklyPlan(plan, {
    items: plan.items.map((item) =>
      item.id === itemId
        ? { ...item, isCompleted: isCompleted ?? !item.isCompleted }
        : item
    ),
  });
}
