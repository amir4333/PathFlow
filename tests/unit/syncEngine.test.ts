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
  createTask,
} from '../../src/domain';

function setupSyncContext() {
  const dbName = `test-sync-db-${generateEntityId()}`;
  const db = new PathFlowDB(dbName);
  const repositories = createLocalRepositories(db);
  const outbox = new InMemorySyncOutbox();
  const remoteClient = new MockRemoteSyncClient();
  const engine = new SyncEngine({
    deviceId: 'test-device-laptop',
    repositories,
    outbox,
    remoteClient,
  });

  return { db, repositories, outbox, remoteClient, engine };
}

test('SyncEngine: Offline state prevents network roundtrips and sets offline status', async () => {
  const { engine, outbox, remoteClient } = setupSyncContext();

  await outbox.enqueue({
    id: generateEntityId(),
    clientMutationId: 'mut-off-1',
    entityType: 'goal',
    entityId: generateEntityId(),
    operation: 'create',
    payload: { title: 'Offline Goal' },
    timestamp: createTimestamp(),
    deviceId: 'test-device',
  });

  engine.setOnline(false);
  const result = await engine.syncOnce();

  assert.equal(result.pushedCount, 0);
  assert.equal(result.pulledCount, 0);
  assert.equal(remoteClient.getPushedMutations().length, 0);

  const status = await engine.getStatus();
  assert.equal(status.state, 'offline');
  assert.equal(status.isOnline, false);
  assert.equal(status.pendingCount, 1);
});

test('SyncEngine: Pushes pending mutations from outbox to remote client and drains queue', async () => {
  const { engine, outbox, remoteClient } = setupSyncContext();

  const goal = createGoal({ title: 'Cloud Architecture Mastery' });

  const mutation: SyncMutation = {
    id: generateEntityId(),
    clientMutationId: 'mut-push-1',
    entityType: 'goal',
    entityId: goal.id,
    operation: 'create',
    payload: goal,
    timestamp: createTimestamp(),
    deviceId: 'test-device',
  };

  await outbox.enqueue(mutation);
  assert.equal(await outbox.getPendingCount(), 1);

  const result = await engine.syncOnce();
  assert.equal(result.pushedCount, 1);
  assert.equal(remoteClient.getPushedMutations().length, 1);

  // Outbox should be drained of synced items
  assert.equal(await outbox.getPendingCount(), 0);
  const remaining = await outbox.getAll();
  assert.equal(remaining.length, 0);

  const status = await engine.getStatus();
  assert.equal(status.state, 'idle');
  assert.ok(status.lastSyncedAt);
});

test('SyncEngine: Pulls incoming remote changes and updates local repositories', async () => {
  const { engine, repositories, remoteClient } = setupSyncContext();

  const remoteGoal = createGoal({
    title: 'Functional Programming in Scala',
    createdAt: '2026-09-21T10:00:00.000Z',
    updatedAt: '2026-09-21T10:00:00.000Z',
  });

  remoteClient.seedRemoteChange({
    entityType: 'goal',
    entityId: remoteGoal.id,
    payload: remoteGoal,
    updatedAt: '2026-09-21T10:00:00.000Z',
  });

  const result = await engine.syncOnce();
  assert.equal(result.pulledCount, 1);

  // Check goal was persisted locally
  const saved = await repositories.goals.getById(remoteGoal.id);
  assert.ok(saved);
  assert.equal(saved.title, 'Functional Programming in Scala');
});

test('SyncEngine: Pulls incoming tombstones and deletes entities from local repository', async () => {
  const { engine, repositories, remoteClient } = setupSyncContext();

  const goal = createGoal({
    title: 'Temporary Goal to Delete',
    createdAt: '2026-09-21T10:00:00.000Z',
    updatedAt: '2026-09-21T10:00:00.000Z',
  });

  await repositories.goals.create(goal);
  assert.ok(await repositories.goals.getById(goal.id));

  // Seed remote tombstone with newer timestamp
  remoteClient.seedRemoteTombstone({
    entityType: 'goal',
    entityId: goal.id,
    deletedAt: '2026-09-21T11:00:00.000Z',
  });

  const result = await engine.syncOnce();
  assert.equal(result.pulledCount, 1);

  // Check goal was deleted locally
  const deleted = await repositories.goals.getById(goal.id);
  assert.equal(deleted, null);
});
