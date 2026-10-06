import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { InMemorySyncOutbox, SyncMutation, createSyncRecordingRepositories } from '../../src/sync';
import { generateEntityId, createTimestamp } from '../../src/domain';
import { PathFlowDB, createLocalRepositories } from '../../src/data';
import { createApplicationServices } from '../../src/application';

test('SyncOutbox: Enqueue mutations in FIFO order with default pending status', async () => {
  const outbox = new InMemorySyncOutbox();

  const mutation1: SyncMutation = {
    id: generateEntityId(),
    clientMutationId: 'mut-1',
    entityType: 'goal',
    entityId: generateEntityId(),
    operation: 'create',
    payload: { title: 'Goal 1' },
    timestamp: createTimestamp(),
    deviceId: 'device-laptop',
  };

  const mutation2: SyncMutation = {
    id: generateEntityId(),
    clientMutationId: 'mut-2',
    entityType: 'task',
    entityId: generateEntityId(),
    operation: 'update',
    payload: { title: 'Task 1' },
    timestamp: createTimestamp(),
    deviceId: 'device-laptop',
  };

  const item1 = await outbox.enqueue(mutation1);
  const item2 = await outbox.enqueue(mutation2);

  assert.equal(item1.status, 'pending');
  assert.equal(item2.status, 'pending');
  assert.equal(item1.retryCount, 0);

  const pending = await outbox.getPending();
  assert.equal(pending.length, 2);
  assert.equal(pending[0].mutation.clientMutationId, 'mut-1');
  assert.equal(pending[1].mutation.clientMutationId, 'mut-2');
});

test('SyncOutbox: Transition statuses through in_flight, synced, and failed with retry count', async () => {
  const outbox = new InMemorySyncOutbox();

  const mutation: SyncMutation = {
    id: generateEntityId(),
    clientMutationId: 'mut-lifecycle',
    entityType: 'session',
    entityId: generateEntityId(),
    operation: 'create',
    payload: { durationMinutes: 45 },
    timestamp: createTimestamp(),
    deviceId: 'device-mobile',
  };

  const item = await outbox.enqueue(mutation);
  assert.equal(await outbox.getPendingCount(), 1);

  // Mark in-flight
  await outbox.markInFlight([item.id]);
  let all = await outbox.getAll();
  assert.equal(all[0].status, 'in_flight');

  // Mark failed
  await outbox.markFailed([item.id], 'Network timeout');
  all = await outbox.getAll();
  assert.equal(all[0].status, 'failed');
  assert.equal(all[0].retryCount, 1);
  assert.equal(all[0].lastError, 'Network timeout');

  // Mark synced
  await outbox.markSynced([item.id]);
  all = await outbox.getAll();
  assert.equal(all[0].status, 'synced');
  assert.equal(await outbox.getPendingCount(), 0);

  // Clear synced
  await outbox.clearSynced();
  all = await outbox.getAll();
  assert.equal(all.length, 0);
});

test('SyncOutbox & SyncRecordingRepositories: SessionService.deleteSession() records session/delete mutation', async () => {
  const db = new PathFlowDB(`test-sync-session-delete-${generateEntityId()}`);
  const baseRepos = createLocalRepositories(db);
  const outbox = new InMemorySyncOutbox();

  const syncRepos = createSyncRecordingRepositories({
    repositories: baseRepos,
    outbox,
    getDeviceId: () => 'device-session-delete-test',
  });

  const services = createApplicationServices(syncRepos);

  const goal = await services.goals.createGoal({ title: 'Sync Session Delete Goal' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Sync Roadmap' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Sync Task' });

  const session = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T11:00:00.000Z',
  });

  // Delete the recorded session via SessionService
  await services.sessions.deleteSession(session.id);

  // Verify session is removed from local storage
  const deleted = await services.sessions.getSession(session.id);
  assert.equal(deleted, null);

  // Verify outbox recorded the session/delete mutation
  const pending = await outbox.getPending();
  const deleteMutationItem = pending.find(
    (item) => item.mutation.entityType === 'session' && item.mutation.operation === 'delete'
  );

  assert.ok(deleteMutationItem, 'Expected a session/delete mutation in the sync outbox');
  assert.equal(deleteMutationItem.mutation.entityId, session.id);
  assert.equal(deleteMutationItem.mutation.payload, null);
  assert.equal(deleteMutationItem.mutation.deviceId, 'device-session-delete-test');

  db.close();
});

