/**
 * Remote Sync Client Interface & Test Double
 *
 * Defines the wire boundary between the client SyncEngine and the remote cloud service.
 */

import {
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse,
  SyncEntityChange,
  SyncTombstone,
  SyncCursor,
} from '../types';
import { createTimestamp } from '../../domain';

export interface RemoteSyncClient {
  push(request: SyncPushRequest): Promise<SyncPushResponse>;
  pull(request: SyncPullRequest): Promise<SyncPullResponse>;
}

/**
 * In-memory test client that simulates remote backend behavior.
 */
export class MockRemoteSyncClient implements RemoteSyncClient {
  private remoteChanges: SyncEntityChange[] = [];
  private remoteTombstones: SyncTombstone[] = [];
  private pushedMutations: SyncPushRequest['mutations'] = [];
  public shouldFail: boolean = false;
  public failureMessage: string = 'Network disconnected';

  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const acceptedIds: string[] = [];
    const rejected: Array<{ mutationId: string; reason: string }> = [];

    for (const m of request.mutations) {
      acceptedIds.push(m.id);
      this.pushedMutations = [...this.pushedMutations, m];

      if (m.operation === 'delete') {
        this.remoteTombstones.push({
          entityType: m.entityType,
          entityId: m.entityId,
          deletedAt: m.timestamp,
        });
      } else if (m.payload) {
        this.remoteChanges.push({
          entityType: m.entityType,
          entityId: m.entityId,
          payload: m.payload,
          updatedAt: m.timestamp,
        });
      }
    }

    return {
      acceptedMutationIds: acceptedIds,
      rejectedMutations: rejected,
      serverTimestamp: createTimestamp(),
    };
  }

  async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const since = request.cursor?.lastSyncTimestamp ?? '1970-01-01T00:00:00.000Z';

    const filteredChanges = this.remoteChanges.filter((c) => c.updatedAt > since);
    const filteredTombstones = this.remoteTombstones.filter((t) => t.deletedAt > since);

    const now = createTimestamp();
    const nextCursor: SyncCursor = {
      lastSyncTimestamp: now,
      serverVersion: (request.cursor?.serverVersion ?? 0) + 1,
    };

    return {
      changes: filteredChanges,
      tombstones: filteredTombstones,
      nextCursor,
      hasMore: false,
    };
  }

  seedRemoteChange(change: SyncEntityChange): void {
    this.remoteChanges.push(change);
  }

  seedRemoteTombstone(tombstone: SyncTombstone): void {
    this.remoteTombstones.push(tombstone);
  }

  getPushedMutations() {
    return this.pushedMutations;
  }

  clear(): void {
    this.remoteChanges = [];
    this.remoteTombstones = [];
    this.pushedMutations = [];
  }
}
