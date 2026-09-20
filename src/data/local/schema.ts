/**
 * PathFlow Local IndexedDB Schema Definitions
 *
 * Defines store names, versioning, and indexed fields for Dexie.js.
 * All indexes directly back realistic query patterns required by repositories.
 */

import { EntityId, Timestamp } from '../../domain';

export const DATABASE_NAME = 'PathFlowDB';
export const CURRENT_SCHEMA_VERSION = 1;

export const STORES = {
  GOALS: 'goals',
  ROADMAPS: 'roadmaps',
  TASKS: 'tasks',
  SESSIONS: 'sessions',
  WEEKLY_PLANS: 'weeklyPlans',
  WEEKLY_PLAN_ITEMS: 'weeklyPlanItems',
} as const;

/**
 * Normalized database record for WeeklyPlan header.
 * Items are stored separately in the weeklyPlanItems store.
 */
export interface WeeklyPlanRecord {
  readonly id: EntityId;
  readonly weekIdentifier: string;
  readonly title: string;
  readonly targetMinutes: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * Version 1 store definitions for Dexie.
 * Note: primary key is first, followed by indexed fields.
 */
export const SCHEMA_V1_STORES = {
  [STORES.GOALS]: 'id, status, createdAt',
  [STORES.ROADMAPS]: 'id, goalId, createdAt',
  [STORES.TASKS]: 'id, roadmapId, status, priority, createdAt',
  [STORES.SESSIONS]: 'id, taskId, startedAt, endedAt',
  [STORES.WEEKLY_PLANS]: 'id, weekIdentifier, createdAt',
  [STORES.WEEKLY_PLAN_ITEMS]: 'id, weeklyPlanId, taskId, targetDate',
} as const;
