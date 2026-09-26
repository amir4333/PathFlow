/**
 * HTTP Remote Sync Client
 *
 * Implements the RemoteSyncClient contract using standard Fetch API to communicate
 * with the PathFlow backend synchronization service.
 */

import {
  RemoteSyncClient,
} from './remoteSyncClient';
import {
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse,
} from '../types';

export interface HttpRemoteSyncClientOptions {
  readonly baseUrl: string;
  readonly getAuthToken: () => string | null | Promise<string | null>;
  readonly timeoutMs?: number;
}

export class HttpRemoteSyncClient implements RemoteSyncClient {
  private readonly baseUrl: string;
  private readonly getAuthToken: () => string | null | Promise<string | null>;
  private readonly timeoutMs: number;

  constructor(options: HttpRemoteSyncClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.getAuthToken = options.getAuthToken;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Authentication required for sync push');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errDetails = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson.error) errDetails = errJson.error;
        } catch {
          // ignore json parse error
        }
        throw new Error(`Sync push failed: ${errDetails}`);
      }

      const data = await response.json();
      return data as SyncPushResponse;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Sync push timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Authentication required for sync pull');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/sync/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errDetails = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson.error) errDetails = errJson.error;
        } catch {
          // ignore json parse error
        }
        throw new Error(`Sync pull failed: ${errDetails}`);
      }

      const data = await response.json();
      return data as SyncPullResponse;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Sync pull timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
