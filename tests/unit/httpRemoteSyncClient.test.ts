import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpRemoteSyncClient } from '../../src/sync';
import { generateEntityId, createTimestamp } from '../../src/domain';

test('HttpRemoteSyncClient: Sends push request with Authorization Bearer header', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: any = null;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    capturedBody = JSON.parse((init?.body as string) || '{}');

    return {
      ok: true,
      status: 200,
      json: async () => ({
        acceptedMutationIds: ['mut-1'],
        rejectedMutations: [],
        serverTimestamp: '2026-09-22T10:00:00.000Z',
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const client = new HttpRemoteSyncClient({
      baseUrl: 'http://localhost:3001',
      getAuthToken: () => 'test-jwt-token-xyz',
    });

    const pushRes = await client.push({
      deviceId: 'laptop-1',
      mutations: [
        {
          id: generateEntityId(),
          clientMutationId: 'c-1',
          entityType: 'goal',
          entityId: generateEntityId(),
          operation: 'create',
          payload: { title: 'Test' },
          timestamp: createTimestamp(),
          deviceId: 'laptop-1',
        },
      ],
    });

    assert.equal(capturedUrl, 'http://localhost:3001/api/sync/push');
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-jwt-token-xyz');
    assert.equal(capturedBody.deviceId, 'laptop-1');
    assert.equal(pushRes.acceptedMutationIds.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('HttpRemoteSyncClient: Propagates network errors cleanly without crashing', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new Error('Connection refused');
  }) as typeof fetch;

  try {
    const client = new HttpRemoteSyncClient({
      baseUrl: 'http://localhost:3001',
      getAuthToken: () => 'token',
    });

    await assert.rejects(
      async () => {
        await client.pull({ cursor: null });
      },
      (err: any) => err.message.includes('Connection refused')
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
