import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SyncEngine,
  InMemorySyncOutbox,
  MockRemoteSyncClient,
  SyncMutation,
} from '../../src/sync';
import {
  PathFlowDB,
  createLocalRepositories,
} from '../../src/data';
import {
  generateEntityId,
  createTimestamp,
  createGoal,
} from '../../src/domain';

test('Sync Lifecycle: Prevents concurrent sync runs', async () => {
  const db = new PathFlowDB(`test-sync-concurrent-${generateEntityId()}`);
  const repos = createLocalRepositories(db);
  const outbox = new InMemorySyncOutbox();

  let pushInvocationCount = 0;
  // Slow mock client that introduces a delay
  const slowClient: any = {
    async push(req: any) {
      pushInvocationCount++;
      await new Promise((res) => setTimeout(res, 40));
      return {
        acceptedMutationIds: req.mutations.map((m: any) => m.id),
        rejectedMutations: [],
        serverTimestamp: createTimestamp(),
      };
    },
    async pull() {
      await new Promise((res) => setTimeout(res, 20));
      return {
        changes: [],
        tombstones: [],
        nextCursor: { lastSyncTimestamp: createTimestamp() },
        hasMore: false,
      };
    },
  };

  const engine = new SyncEngine({
    deviceId: 'test-device-1',
    repositories: repos,
    outbox,
    remoteClient: slowClient,
  });

  // Enqueue a mutation
  const goal = createGoal({ title: 'Concurrent Sync Invariant Check' });
  await outbox.enqueue({
    id: generateEntityId(),
    clientMutationId: 'mut-concurrent-1',
    entityType: 'goal',
    entityId: goal.id,
    operation: 'create',
    payload: goal,
    timestamp: createTimestamp(),
    deviceId: 'test-device-1',
  });

  // Launch two syncs concurrently
  const sync1Promise = engine.syncOnce();
  const sync2Promise = engine.syncOnce();

  const [res1, res2] = await Promise.all([sync1Promise, sync2Promise]);

  // One of them was executed, the second was prevented from running concurrently
  assert.equal(pushInvocationCount, 1, 'Push must only be invoked once, preventing concurrent execution');
  assert.ok(res1.pushedCount === 1 || res2.pushedCount === 1);
  assert.ok(res1.pushedCount === 0 || res2.pushedCount === 0);
});

test('Sync Lifecycle: Offline to online transition and automatic recovery', async () => {
  const db = new PathFlowDB(`test-sync-offline-${generateEntityId()}`);
  const repos = createLocalRepositories(db);
  const outbox = new InMemorySyncOutbox();
  const mockClient = new MockRemoteSyncClient();

  const engine = new SyncEngine({
    deviceId: 'test-device-2',
    repositories: repos,
    outbox,
    remoteClient: mockClient,
    isOnline: false,
  });

  // 1. Initial offline state
  const status1 = await engine.getStatus();
  assert.equal(status1.isOnline, false);
  assert.equal(status1.state, 'offline');
  assert.equal(status1.connectionState, 'offline');

  // Enqueue mutation while offline
  const goal = createGoal({ title: 'Offline-First Resilience' });
  await outbox.enqueue({
    id: generateEntityId(),
    clientMutationId: 'mut-offline-1',
    entityType: 'goal',
    entityId: goal.id,
    operation: 'create',
    payload: goal,
    timestamp: createTimestamp(),
    deviceId: 'test-device-2',
  });

  // Attempt sync while offline -> immediately aborted without network call
  const offlineRun = await engine.syncOnce();
  assert.equal(offlineRun.pushedCount, 0);
  assert.equal(await outbox.getPendingCount(), 1, 'Pending mutation preserved in outbox');

  // 2. Connectivity returns
  engine.setOnline(true);
  const status2 = await engine.getStatus();
  assert.equal(status2.isOnline, true);
  assert.equal(status2.connectionState, 'connected');

  // 3. Sync succeeds
  const onlineRun = await engine.syncOnce();
  assert.equal(onlineRun.pushedCount, 1);
  assert.equal(await outbox.getPendingCount(), 0, 'Outbox cleared after successful sync');
});

test('Sync Lifecycle: Failed sync preserves local outbox and increments retry count', async () => {
  const db = new PathFlowDB(`test-sync-fail-${generateEntityId()}`);
  const repos = createLocalRepositories(db);
  const outbox = new InMemorySyncOutbox();

  const failingClient: any = {
    async push() {
      throw new Error('503 Service Unavailable: Remote database temporarily unreachable');
    },
    async pull() {
      return { changes: [], tombstones: [], nextCursor: { lastSyncTimestamp: createTimestamp() }, hasMore: false };
    },
  };

  const engine = new SyncEngine({
    deviceId: 'test-device-3',
    repositories: repos,
    outbox,
    remoteClient: failingClient,
  });

  // Enqueue mutation
  const goal = createGoal({ title: 'Preserve Local Data on Failure' });
  const item = await outbox.enqueue({
    id: generateEntityId(),
    clientMutationId: 'mut-fail-1',
    entityType: 'goal',
    entityId: goal.id,
    operation: 'create',
    payload: goal,
    timestamp: createTimestamp(),
    deviceId: 'test-device-3',
  });

  // Sync fails
  await engine.syncOnce();

  const status = await engine.getStatus();
  assert.equal(status.state, 'error');
  assert.equal(status.connectionState, 'server_unavailable');
  assert.match(status.lastError ?? '', /503 Service Unavailable/);

  // Verify mutation is NOT lost, but marked failed with retryCount = 1
  const allItems = await outbox.getAll();
  assert.equal(allItems.length, 1);
  assert.equal(allItems[0].status, 'failed');
  assert.equal(allItems[0].retryCount, 1);
  assert.match(allItems[0].lastError ?? '', /503 Service Unavailable/);

  // Failed items under 5 retries are still available for retry
  const pendingForRetry = await outbox.getPending();
  assert.equal(pendingForRetry.length, 1, 'Failed mutation must be retried on subsequent sync');
});

test('Sync Lifecycle: 401 Unauthorized marks connectionState as auth_required', async () => {
  const db = new PathFlowDB(`test-sync-auth-${generateEntityId()}`);
  const repos = createLocalRepositories(db);
  const outbox = new InMemorySyncOutbox();

  const unauthorizedClient: any = {
    async push() {
      throw new Error('Sync push failed: HTTP 401 Unauthorized token expired');
    },
    async pull() {
      throw new Error('Sync pull failed: HTTP 401 Unauthorized token expired');
    },
  };

  const engine = new SyncEngine({
    deviceId: 'test-device-4',
    repositories: repos,
    outbox,
    remoteClient: unauthorizedClient,
  });

  await outbox.enqueue({
    id: generateEntityId(),
    clientMutationId: 'mut-auth-1',
    entityType: 'goal',
    entityId: generateEntityId(),
    operation: 'create',
    payload: {},
    timestamp: createTimestamp(),
    deviceId: 'test-device-4',
  });

  await engine.syncOnce();

  const status = await engine.getStatus();
  assert.equal(status.state, 'error');
  assert.equal(status.connectionState, 'auth_required');
});
