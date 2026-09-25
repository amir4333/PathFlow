/**
 * Synchronization & Teacher Access Type Definitions
 *
 * Establishes typed contracts for:
 * 1. Offline mutation queueing (Outbox Pattern)
 * 2. Push/Pull delta synchronization payloads
 * 3. Soft deletes & Tombstones
 * 4. Conflict resolution models
 * 5. Student-controlled Teacher Access Grants
 */

import { EntityId, Timestamp } from '../domain';

export type SyncEntityType =
  | 'goal'
  | 'roadmap'
  | 'task'
  | 'session'
  | 'weeklyPlan'
  | 'weeklyPlanItem'
  | 'teacherGrant';

export type SyncOperation = 'create' | 'update' | 'delete';

/**
 * Atomic local mutation to be synchronized with the remote service.
 */
export interface SyncMutation<T = unknown> {
  readonly id: EntityId;
  readonly clientMutationId: string;
  readonly entityType: SyncEntityType;
  readonly entityId: EntityId;
  readonly operation: SyncOperation;
  readonly payload: T | null;
  readonly timestamp: Timestamp;
  readonly deviceId: string;
}

export type SyncOutboxStatus = 'pending' | 'in_flight' | 'synced' | 'failed';

/**
 * Wrapped mutation record managed by the local Outbox Queue.
 */
export interface SyncOutboxItem<T = unknown> {
  readonly id: string;
  readonly mutation: SyncMutation<T>;
  readonly status: SyncOutboxStatus;
  readonly retryCount: number;
  readonly lastError?: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * Tombstone record preserving the deletion of an entity.
 */
export interface SyncTombstone {
  readonly entityType: SyncEntityType;
  readonly entityId: EntityId;
  readonly deletedAt: Timestamp;
}

/**
 * Incremental synchronization position cursor.
 */
export interface SyncCursor {
  readonly lastSyncTimestamp: Timestamp;
  readonly serverVersion?: number;
}

/**
 * Payload sent to remote server when pushing pending client mutations.
 */
export interface SyncPushRequest {
  readonly deviceId: string;
  readonly mutations: readonly SyncMutation[];
}

/**
 * Response from remote server after evaluating client mutations.
 */
export interface SyncPushResponse {
  readonly acceptedMutationIds: readonly string[];
  readonly rejectedMutations: readonly {
    readonly mutationId: string;
    readonly reason: string;
  }[];
  readonly serverTimestamp: Timestamp;
}

/**
 * Request sent to pull remote changes since the given cursor.
 */
export interface SyncPullRequest {
  readonly cursor: SyncCursor | null;
  readonly limit?: number;
}

/**
 * Single entity change delivered from the remote server.
 */
export interface SyncEntityChange {
  readonly entityType: SyncEntityType;
  readonly entityId: EntityId;
  readonly payload: unknown;
  readonly updatedAt: Timestamp;
}

/**
 * Incremental changes returned by the remote server.
 */
export interface SyncPullResponse {
  readonly changes: readonly SyncEntityChange[];
  readonly tombstones: readonly SyncTombstone[];
  readonly nextCursor: SyncCursor;
  readonly hasMore: boolean;
}

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

/**
 * Current health and lifecycle status of the synchronization engine.
 */
export interface SyncStatus {
  readonly state: SyncState;
  readonly isOnline: boolean;
  readonly pendingCount: number;
  readonly lastSyncedAt?: Timestamp;
  readonly lastError?: string;
}

/**
 * Granular read-only permissions assignable to a Teacher Access Grant.
 */
export type TeacherPermission =
  | 'read:goals'
  | 'read:roadmaps'
  | 'read:tasks'
  | 'read:sessions'
  | 'read:weekly_plans'
  | 'read:reports';

export const ALL_TEACHER_PERMISSIONS: readonly TeacherPermission[] = [
  'read:goals',
  'read:roadmaps',
  'read:tasks',
  'read:sessions',
  'read:weekly_plans',
  'read:reports',
] as const;

/**
 * Student-authorized access grant allowing a mentor/teacher remote read-only observation.
 */
export interface TeacherAccessGrant {
  readonly id: EntityId;
  readonly studentId: EntityId;
  readonly label: string;
  readonly token: string;
  readonly role: 'read_only';
  readonly permissions: readonly TeacherPermission[];
  readonly createdAt: Timestamp;
  readonly expiresAt?: Timestamp;
  readonly revokedAt?: Timestamp;
  readonly isActive: boolean;
}
