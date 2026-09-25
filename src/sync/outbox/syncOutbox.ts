/**
 * Sync Outbox (Durable Mutation Queue)
 *
 * Implements the Outbox pattern for offline-first mutation tracking.
 * Guarantees FIFO execution order, idempotency tracking, and retry state.
 */

import { generateEntityId, createTimestamp } from '../../domain';
import { SyncMutation, SyncOutboxItem, SyncOutboxStatus } from '../types';

export interface SyncOutboxRepository {
  enqueue<T = unknown>(mutation: SyncMutation<T>): Promise<SyncOutboxItem<T>>;
  getPending(limit?: number): Promise<SyncOutboxItem[]>;
  markInFlight(ids: readonly string[]): Promise<void>;
  markSynced(ids: readonly string[]): Promise<void>;
  markFailed(ids: readonly string[], errorMessage: string): Promise<void>;
  getPendingCount(): Promise<number>;
  getAll(): Promise<SyncOutboxItem[]>;
  clearSynced(): Promise<void>;
  clearAll(): Promise<void>;
}

export class InMemorySyncOutbox implements SyncOutboxRepository {
  private items: SyncOutboxItem[] = [];

  async enqueue<T = unknown>(mutation: SyncMutation<T>): Promise<SyncOutboxItem<T>> {
    const now = createTimestamp();
    const item: SyncOutboxItem<T> = {
      id: generateEntityId(),
      mutation,
      status: 'pending',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.items.push(item as SyncOutboxItem);
    return item;
  }

  async getPending(limit?: number): Promise<SyncOutboxItem[]> {
    const pending = this.items.filter(
      (item) => item.status === 'pending' || (item.status === 'failed' && item.retryCount < 5)
    );
    return limit ? pending.slice(0, limit) : pending;
  }

  async markInFlight(ids: readonly string[]): Promise<void> {
    const idSet = new Set(ids);
    const now = createTimestamp();
    this.items = this.items.map((item) => {
      if (idSet.has(item.id) || idSet.has(item.mutation.id)) {
        return {
          ...item,
          status: 'in_flight' as SyncOutboxStatus,
          updatedAt: now,
        };
      }
      return item;
    });
  }

  async markSynced(ids: readonly string[]): Promise<void> {
    const idSet = new Set(ids);
    const now = createTimestamp();
    this.items = this.items.map((item) => {
      if (idSet.has(item.id) || idSet.has(item.mutation.id)) {
        return {
          ...item,
          status: 'synced' as SyncOutboxStatus,
          updatedAt: now,
        };
      }
      return item;
    });
  }

  async markFailed(ids: readonly string[], errorMessage: string): Promise<void> {
    const idSet = new Set(ids);
    const now = createTimestamp();
    this.items = this.items.map((item) => {
      if (idSet.has(item.id) || idSet.has(item.mutation.id)) {
        return {
          ...item,
          status: 'failed' as SyncOutboxStatus,
          retryCount: item.retryCount + 1,
          lastError: errorMessage,
          updatedAt: now,
        };
      }
      return item;
    });
  }

  async getPendingCount(): Promise<number> {
    return this.items.filter((item) => item.status === 'pending' || item.status === 'in_flight')
      .length;
  }

  async getAll(): Promise<SyncOutboxItem[]> {
    return [...this.items];
  }

  async clearSynced(): Promise<void> {
    this.items = this.items.filter((item) => item.status !== 'synced');
  }

  async clearAll(): Promise<void> {
    this.items = [];
  }
}
