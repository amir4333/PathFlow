/**
 * Backend Sync Service
 *
 * Implements server-side delta synchronization, strict idempotency enforcement,
 * and student ownership validation.
 */

import { DatabaseStore } from '../db/types';

export interface ServerSyncPushRequest {
  readonly deviceId: string;
  readonly mutations: readonly {
    readonly id: string;
    readonly clientMutationId: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly operation: string;
    readonly payload: any;
    readonly timestamp: string;
    readonly deviceId?: string;
  }[];
}

export interface ServerSyncPushResponse {
  readonly acceptedMutationIds: readonly string[];
  readonly rejectedMutations: readonly {
    readonly mutationId: string;
    readonly reason: string;
  }[];
  readonly serverTimestamp: string;
}

export interface ServerSyncPullRequest {
  readonly cursor: {
    readonly lastSyncTimestamp?: string;
    readonly serverVersion?: number;
  } | null;
  readonly limit?: number;
}

export interface ServerSyncPullResponse {
  readonly changes: readonly {
    readonly entityType: string;
    readonly entityId: string;
    readonly payload: any;
    readonly updatedAt: string;
  }[];
  readonly tombstones: readonly {
    readonly entityType: string;
    readonly entityId: string;
    readonly deletedAt: string;
  }[];
  readonly nextCursor: {
    readonly lastSyncTimestamp: string;
    readonly serverVersion: number;
  };
  readonly hasMore: boolean;
}

export class SyncService {
  constructor(private readonly store: DatabaseStore) {}

  /**
   * Processes a batch of client mutations idempotently.
   */
  async processPush(
    studentId: string,
    request: ServerSyncPushRequest
  ): Promise<ServerSyncPushResponse> {
    const acceptedMutationIds: string[] = [];
    const rejectedMutations: Array<{ mutationId: string; reason: string }> = [];

    const deviceId = request.deviceId;

    for (const mutation of request.mutations) {
      try {
        // 1. Check idempotency: Has this exact mutation already been processed?
        const existing = await this.store.findMutationByClientKey(
          studentId,
          deviceId,
          mutation.clientMutationId
        );

        if (existing) {
          // Already applied; acknowledge immediately without re-applying side effects
          acceptedMutationIds.push(mutation.id);
          continue;
        }

        // 2. Apply mutation to entity storage
        await this.applyEntityMutation(studentId, mutation);

        // 3. Record the mutation in persistent audit log
        await this.store.recordMutation({
          studentId,
          deviceId,
          clientMutationId: mutation.clientMutationId,
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          operation: mutation.operation,
          payload: mutation.payload ? JSON.stringify(mutation.payload) : null,
          timestamp: mutation.timestamp,
        });

        acceptedMutationIds.push(mutation.id);
      } catch (err: any) {
        rejectedMutations.push({
          mutationId: mutation.id,
          reason: err?.message ?? 'Unknown processing error',
        });
      }
    }

    return {
      acceptedMutationIds,
      rejectedMutations,
      serverTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Generates delta changesets and tombstones since the requested cursor.
   */
  async processPull(
    studentId: string,
    request: ServerSyncPullRequest
  ): Promise<ServerSyncPullResponse> {
    const cursor = request.cursor;
    const queryCursor =
      cursor?.serverVersion !== undefined && cursor.serverVersion > 0
        ? cursor.serverVersion
        : cursor?.lastSyncTimestamp ?? '1970-01-01T00:00:00.000Z';
    const limit = request.limit ?? 100;

    // Fetch mutations after cursor
    const mutations = await this.store.getMutationsAfter(studentId, queryCursor, limit);
    // Fetch tombstones after cursor
    const tombstones = await this.store.getTombstonesAfter(studentId, queryCursor);

    const changes = mutations
      .filter((m) => m.operation !== 'delete' && m.payload !== null)
      .map((m) => {
        let parsedPayload = {};
        try {
          parsedPayload = JSON.parse(m.payload || '{}');
        } catch {
          parsedPayload = {};
        }
        return {
          entityType: m.entityType,
          entityId: m.entityId,
          payload: parsedPayload,
          updatedAt: m.timestamp,
        };
      });

    const tombstoneChanges = tombstones.map((t) => ({
      entityType: t.entityType,
      entityId: t.entityId,
      deletedAt: t.deletedAt,
    }));

    const maxSeq = await this.store.getMaxSequence(studentId);

    return {
      changes,
      tombstones: tombstoneChanges,
      nextCursor: {
        lastSyncTimestamp: new Date().toISOString(),
        serverVersion: maxSeq,
      },
      hasMore: mutations.length === limit,
    };
  }

  private async applyEntityMutation(studentId: string, mutation: any): Promise<void> {
    const { entityType, entityId, operation, payload, timestamp } = mutation;

    if (operation === 'delete') {
      // Record tombstone
      await this.store.recordTombstone({
        studentId,
        entityType,
        entityId,
        deletedAt: timestamp,
      });

      // Delete from active entities
      switch (entityType) {
        case 'goal':
          await this.store.deleteGoal(studentId, entityId);
          break;
        case 'roadmap':
          await this.store.deleteRoadmap(studentId, entityId);
          break;
        case 'task':
          await this.store.deleteTask(studentId, entityId);
          break;
        case 'session':
          await this.store.deleteSession(studentId, entityId);
          break;
        case 'weeklyPlan':
          await this.store.deleteWeeklyPlan(studentId, entityId);
          break;
        case 'weeklyPlanItem':
          await this.store.deleteWeeklyPlanItem(studentId, entityId);
          break;
      }
      return;
    }

    // Create or Update
    if (!payload) return;

    switch (entityType) {
      case 'goal':
        await this.store.upsertGoal({
          id: entityId,
          studentId,
          title: payload.title ?? '',
          description: payload.description ?? '',
          status: payload.status ?? 'not_started',
          createdAt: payload.createdAt ?? timestamp,
          updatedAt: payload.updatedAt ?? timestamp,
        });
        break;

      case 'roadmap':
        await this.store.upsertRoadmap({
          id: entityId,
          studentId,
          goalId: payload.goalId,
          title: payload.title ?? '',
          createdAt: payload.createdAt ?? timestamp,
          updatedAt: payload.updatedAt ?? timestamp,
        });
        break;

      case 'task':
        await this.store.upsertTask({
          id: entityId,
          studentId,
          roadmapId: payload.roadmapId,
          title: payload.title ?? '',
          description: payload.description ?? '',
          status: payload.status ?? 'todo',
          priority: payload.priority ?? 'medium',
          estimatedMinutes: payload.estimatedMinutes ?? 0,
          createdAt: payload.createdAt ?? timestamp,
          updatedAt: payload.updatedAt ?? timestamp,
          completedAt: payload.completedAt ?? null,
        });
        break;

      case 'session':
        await this.store.upsertSession({
          id: entityId,
          studentId,
          taskId: payload.taskId,
          startedAt: payload.startedAt,
          endedAt: payload.endedAt,
          durationMinutes: payload.durationMinutes ?? 0,
        });
        break;

      case 'weeklyPlan':
        await this.store.upsertWeeklyPlan({
          id: entityId,
          studentId,
          weekIdentifier: payload.weekIdentifier,
          title: payload.title ?? '',
          targetMinutes: payload.targetMinutes ?? 0,
          createdAt: payload.createdAt ?? timestamp,
          updatedAt: payload.updatedAt ?? timestamp,
        });
        break;

      case 'weeklyPlanItem':
        await this.store.upsertWeeklyPlanItem({
          id: entityId,
          studentId,
          weeklyPlanId: payload.weeklyPlanId,
          taskId: payload.taskId,
          targetDate: payload.targetDate ?? null,
          plannedMinutes: payload.plannedMinutes ?? 0,
          isCompleted: payload.isCompleted ?? false,
        });
        break;
    }
  }
}
