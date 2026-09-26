/**
 * Sync Engine
 *
 * Coordinates non-blocking background synchronization cycles between local storage
 * and the remote sync client.
 */

import { PathFlowRepositories } from '../../data/repositories/local';
import { SyncOutboxRepository } from '../outbox/syncOutbox';
import { RemoteSyncClient } from './remoteSyncClient';
import { ConflictResolver } from '../conflict/conflictResolver';
import {
  SyncStatus,
  SyncCursor,
  SyncState,
  SyncConnectionState,
  SyncEntityChange,
  SyncTombstone,
} from '../types';
import { createTimestamp, Goal, Roadmap, Task, Session, WeeklyPlanItem } from '../../domain';

export interface SyncEngineOptions {
  readonly deviceId: string;
  readonly repositories: PathFlowRepositories;
  readonly outbox: SyncOutboxRepository;
  readonly remoteClient: RemoteSyncClient;
  readonly conflictResolver?: ConflictResolver;
  readonly isOnline?: boolean;
}

export type SyncStatusListener = (status: SyncStatus) => void;

export class SyncEngine {
  private readonly deviceId: string;
  private readonly repositories: PathFlowRepositories;
  private readonly outbox: SyncOutboxRepository;
  private readonly remoteClient: RemoteSyncClient;
  private readonly conflictResolver: ConflictResolver;

  private isOnline: boolean;
  private state: SyncState = 'idle';
  private cursor: SyncCursor | null = null;
  private lastSyncedAt?: string;
  private lastError?: string;
  private listeners: Set<SyncStatusListener> = new Set();
  private autoSyncIntervalId?: any;
  private onlineHandler?: () => void;
  private offlineHandler?: () => void;

  constructor(options: SyncEngineOptions) {
    this.deviceId = options.deviceId;
    this.repositories = options.repositories;
    this.outbox = options.outbox;
    this.remoteClient = options.remoteClient;
    this.conflictResolver = options.conflictResolver ?? new ConflictResolver();
    this.isOnline = options.isOnline ?? true;
    this.state = this.isOnline ? 'idle' : 'offline';
  }

  setOnline(online: boolean): void {
    this.isOnline = online;
    if (!online) {
      this.state = 'offline';
    } else if (this.state === 'offline') {
      this.state = 'idle';
    }
    this.notifyStatus();
  }

  private computeConnectionState(): SyncConnectionState {
    if (!this.isOnline) {
      return 'offline';
    }
    if (this.state === 'syncing') {
      return 'connecting';
    }
    if (this.state === 'error') {
      const err = (this.lastError || '').toLowerCase();
      if (
        err.includes('auth') ||
        err.includes('401') ||
        err.includes('unauthorized') ||
        err.includes('token')
      ) {
        return 'auth_required';
      }
      if (
        err.includes('fetch') ||
        err.includes('network') ||
        err.includes('timeout') ||
        err.includes('timed out') ||
        err.includes('econnrefused') ||
        err.includes('503') ||
        err.includes('unavailable')
      ) {
        return 'server_unavailable';
      }
      return 'error';
    }
    return 'connected';
  }

  async getStatus(): Promise<SyncStatus> {
    const pendingCount = await this.outbox.getPendingCount();
    return {
      state: this.state,
      connectionState: this.computeConnectionState(),
      isOnline: this.isOnline,
      pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    this.getStatus().then(listener);
    return () => this.listeners.delete(listener);
  }

  private async notifyStatus(): Promise<void> {
    const status = await this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  startAutoSync(options: { intervalMs?: number } = {}): void {
    this.stopAutoSync();
    const intervalMs = options.intervalMs ?? 60000;

    if (typeof window !== 'undefined') {
      this.onlineHandler = () => {
        this.setOnline(true);
        this.syncOnce().catch(() => {});
      };
      this.offlineHandler = () => {
        this.setOnline(false);
      };
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }

    this.autoSyncIntervalId = setInterval(() => {
      if (this.isOnline && this.state !== 'syncing') {
        this.syncOnce().catch(() => {});
      }
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.autoSyncIntervalId) {
      clearInterval(this.autoSyncIntervalId);
      this.autoSyncIntervalId = undefined;
    }
    if (typeof window !== 'undefined') {
      if (this.onlineHandler) {
        window.removeEventListener('online', this.onlineHandler);
        this.onlineHandler = undefined;
      }
      if (this.offlineHandler) {
        window.removeEventListener('offline', this.offlineHandler);
        this.offlineHandler = undefined;
      }
    }
  }

  resetCursor(): void {
    this.cursor = null;
    this.lastSyncedAt = undefined;
    this.lastError = undefined;
    this.state = this.isOnline ? 'idle' : 'offline';
    this.notifyStatus();
  }

  /**
   * Executes a single synchronized push and pull iteration.
   * Prevents concurrent sync runs.
   */
  async syncOnce(): Promise<{ pushedCount: number; pulledCount: number }> {
    if (!this.isOnline) {
      this.state = 'offline';
      await this.notifyStatus();
      return { pushedCount: 0, pulledCount: 0 };
    }

    if (this.state === 'syncing') {
      return { pushedCount: 0, pulledCount: 0 };
    }

    this.state = 'syncing';
    this.lastError = undefined;
    await this.notifyStatus();

    let pushedCount = 0;
    let pulledCount = 0;

    try {
      // 1. Push Phase: Send pending mutations from outbox
      const pendingItems = await this.outbox.getPending(50);
      if (pendingItems.length > 0) {
        const itemIds = pendingItems.map((i) => i.id);
        await this.outbox.markInFlight(itemIds);

        try {
          const pushResponse = await this.remoteClient.push({
            deviceId: this.deviceId,
            mutations: pendingItems.map((i) => i.mutation),
          });

          await this.outbox.markSynced(pushResponse.acceptedMutationIds);
          pushedCount = pushResponse.acceptedMutationIds.length;

          if (pushResponse.rejectedMutations.length > 0) {
            for (const r of pushResponse.rejectedMutations) {
              await this.outbox.markFailed([r.mutationId], r.reason);
            }
          }

          await this.outbox.clearSynced();
        } catch (err: any) {
          await this.outbox.markFailed(itemIds, err?.message ?? 'Push failure');
          throw err;
        }
      }

      // 2. Pull Phase: Fetch remote changes since current cursor
      const pullResponse = await this.remoteClient.pull({
        cursor: this.cursor,
      });

      // Apply incoming changes
      for (const change of pullResponse.changes) {
        await this.applyIncomingChange(change);
        pulledCount++;
      }

      // Apply incoming tombstones
      for (const tombstone of pullResponse.tombstones) {
        await this.applyIncomingTombstone(tombstone);
        pulledCount++;
      }

      this.cursor = pullResponse.nextCursor;
      this.lastSyncedAt = createTimestamp();
      this.state = 'idle';
    } catch (err: any) {
      this.state = 'error';
      this.lastError = err?.message ?? 'Sync failed';
    } finally {
      await this.notifyStatus();
    }

    return { pushedCount, pulledCount };
  }

  private async applyIncomingChange(change: SyncEntityChange): Promise<void> {
    const { entityType, entityId, payload } = change;

    switch (entityType) {
      case 'goal': {
        const local = await this.repositories.goals.getById(entityId);
        const resolution = this.conflictResolver.resolveEntityConflict('goal', local, payload as Goal);
        if (resolution.action === 'apply_remote' || resolution.action === 'merge') {
          if (local) {
            await this.repositories.goals.update(resolution.entity);
          } else {
            await this.repositories.goals.create(resolution.entity);
          }
        }
        break;
      }
      case 'roadmap': {
        const local = await this.repositories.roadmaps.getById(entityId);
        const resolution = this.conflictResolver.resolveEntityConflict('roadmap', local, payload as Roadmap);
        if (resolution.action === 'apply_remote' || resolution.action === 'merge') {
          if (local) {
            await this.repositories.roadmaps.update(resolution.entity);
          } else {
            await this.repositories.roadmaps.create(resolution.entity);
          }
        }
        break;
      }
      case 'task': {
        const local = await this.repositories.tasks.getById(entityId);
        const resolution = this.conflictResolver.resolveEntityConflict('task', local, payload as Task);
        if (resolution.action === 'apply_remote' || resolution.action === 'merge') {
          if (local) {
            await this.repositories.tasks.update(resolution.entity);
          } else {
            await this.repositories.tasks.create(resolution.entity);
          }
        }
        break;
      }
      case 'session': {
        const local = await this.repositories.sessions.getById(entityId);
        const resolution = this.conflictResolver.resolveEntityConflict('session', local, payload as Session);
        if (resolution.action === 'apply_remote') {
          if (local) {
            await this.repositories.sessions.update(resolution.entity);
          } else {
            await this.repositories.sessions.create(resolution.entity);
          }
        }
        break;
      }
      case 'weeklyPlanItem': {
        const local = await this.repositories.weeklyPlanItems.getById(entityId);
        const resolution = this.conflictResolver.resolveEntityConflict('weeklyPlanItem', local, payload as WeeklyPlanItem);
        if (resolution.action === 'apply_remote') {
          if (local) {
            await this.repositories.weeklyPlanItems.update(resolution.entity);
          } else {
            await this.repositories.weeklyPlanItems.create(resolution.entity);
          }
        }
        break;
      }
    }
  }

  private async applyIncomingTombstone(tombstone: SyncTombstone): Promise<void> {
    const { entityType, entityId } = tombstone;

    switch (entityType) {
      case 'goal': {
        const local = await this.repositories.goals.getById(entityId);
        const result = this.conflictResolver.resolveTombstoneConflict(local, tombstone);
        if (result === 'tombstone_wins' && local) {
          await this.repositories.goals.delete(entityId);
        }
        break;
      }
      case 'roadmap': {
        const local = await this.repositories.roadmaps.getById(entityId);
        const result = this.conflictResolver.resolveTombstoneConflict(local, tombstone);
        if (result === 'tombstone_wins' && local) {
          await this.repositories.roadmaps.delete(entityId);
        }
        break;
      }
      case 'task': {
        const local = await this.repositories.tasks.getById(entityId);
        const result = this.conflictResolver.resolveTombstoneConflict(local, tombstone);
        if (result === 'tombstone_wins' && local) {
          await this.repositories.tasks.delete(entityId);
        }
        break;
      }
      case 'session': {
        const local = await this.repositories.sessions.getById(entityId);
        const result = this.conflictResolver.resolveTombstoneConflict(local, tombstone);
        if (result === 'tombstone_wins' && local) {
          await this.repositories.sessions.delete(entityId);
        }
        break;
      }
      case 'weeklyPlanItem': {
        const local = await this.repositories.weeklyPlanItems.getById(entityId);
        const result = this.conflictResolver.resolveTombstoneConflict(local, tombstone);
        if (result === 'tombstone_wins' && local) {
          await this.repositories.weeklyPlanItems.delete(entityId);
        }
        break;
      }
    }
  }

  getCursor(): SyncCursor | null {
    return this.cursor;
  }
}
