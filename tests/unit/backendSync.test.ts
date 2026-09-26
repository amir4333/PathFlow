import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../server/src/app';
import { MemoryDatabaseStore } from '../../server/src/db/memoryStore';
import { generateEntityId, createTimestamp } from '../../src/domain';

test('Backend Sync: Idempotency prevents duplicate application of the same mutation', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  // Register student
  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'idempotent@example.com', password: 'password123' },
  });
  const token = JSON.parse(reg.payload).token;

  const taskId = generateEntityId();
  const mutationPayload = {
    deviceId: 'device-laptop',
    mutations: [
      {
        id: generateEntityId(),
        clientMutationId: 'client-mut-unique-123',
        entityType: 'task',
        entityId: taskId,
        operation: 'create',
        payload: { title: 'Implement Compiler Lexer', status: 'todo' },
        timestamp: createTimestamp(),
      },
    ],
  };

  // First push
  const res1 = await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { authorization: `Bearer ${token}` },
    payload: mutationPayload,
  });
  assert.equal(res1.statusCode, 200);
  const body1 = JSON.parse(res1.payload);
  assert.equal(body1.acceptedMutationIds.length, 1);

  // Second push (Simulating network retry or duplicate packet with identical clientMutationId)
  const res2 = await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { authorization: `Bearer ${token}` },
    payload: mutationPayload,
  });
  assert.equal(res2.statusCode, 200);
  const body2 = JSON.parse(res2.payload);
  // Still accepted (idempotent ack), but not re-applied
  assert.equal(body2.acceptedMutationIds.length, 1);

  // Pull deltas: exactly 1 mutation should be returned, NOT two!
  const pullRes = await app.inject({
    method: 'POST',
    url: '/api/sync/pull',
    headers: { authorization: `Bearer ${token}` },
    payload: { cursor: null },
  });
  assert.equal(pullRes.statusCode, 200);
  const pullBody = JSON.parse(pullRes.payload);
  assert.equal(pullBody.changes.length, 1);
  assert.equal(pullBody.changes[0].entityId, taskId);
});

test('Backend Sync: Cursor advancement and incremental pull', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'cursor@example.com', password: 'password123' },
  });
  const token = JSON.parse(reg.payload).token;

  // Push Goal 1
  await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      deviceId: 'dev-1',
      mutations: [
        {
          id: generateEntityId(),
          clientMutationId: 'c-mut-1',
          entityType: 'goal',
          entityId: generateEntityId(),
          operation: 'create',
          payload: { title: 'First Goal' },
          timestamp: '2026-09-20T10:00:00.000Z',
        },
      ],
    },
  });

  // Pull with cursor = null
  const pull1 = await app.inject({
    method: 'POST',
    url: '/api/sync/pull',
    headers: { authorization: `Bearer ${token}` },
    payload: { cursor: null },
  });
  const pull1Body = JSON.parse(pull1.payload);
  assert.equal(pull1Body.changes.length, 1);
  const cursor1 = pull1Body.nextCursor;

  // Push Goal 2 after cursor 1
  await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      deviceId: 'dev-1',
      mutations: [
        {
          id: generateEntityId(),
          clientMutationId: 'c-mut-2',
          entityType: 'goal',
          entityId: generateEntityId(),
          operation: 'create',
          payload: { title: 'Second Goal' },
          timestamp: '2026-09-20T12:00:00.000Z',
        },
      ],
    },
  });

  // Pull with cursor 1
  const pull2 = await app.inject({
    method: 'POST',
    url: '/api/sync/pull',
    headers: { authorization: `Bearer ${token}` },
    payload: { cursor: cursor1 },
  });
  const pull2Body = JSON.parse(pull2.payload);
  // Only Goal 2 should be returned!
  assert.equal(pull2Body.changes.length, 1);
  assert.equal(pull2Body.changes[0].payload.title, 'Second Goal');
});

test('Backend Sync: Tombstone synchronization for deletions', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'tombstone@example.com', password: 'password123' },
  });
  const token = JSON.parse(reg.payload).token;

  const sessionId = generateEntityId();

  // Create session
  await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      deviceId: 'dev-phone',
      mutations: [
        {
          id: generateEntityId(),
          clientMutationId: 'mut-sess-1',
          entityType: 'session',
          entityId: sessionId,
          operation: 'create',
          payload: { durationMinutes: 60, taskId: 'task-1', startedAt: '2026-09-21T10:00:00.000Z', endedAt: '2026-09-21T11:00:00.000Z' },
          timestamp: '2026-09-21T11:00:00.000Z',
        },
      ],
    },
  });

  // Delete session
  await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      deviceId: 'dev-phone',
      mutations: [
        {
          id: generateEntityId(),
          clientMutationId: 'mut-sess-del',
          entityType: 'session',
          entityId: sessionId,
          operation: 'delete',
          payload: null,
          timestamp: '2026-09-21T11:30:00.000Z',
        },
      ],
    },
  });

  // Pull deltas
  const pull = await app.inject({
    method: 'POST',
    url: '/api/sync/pull',
    headers: { authorization: `Bearer ${token}` },
    payload: { cursor: null },
  });
  const pullBody = JSON.parse(pull.payload);
  assert.equal(pullBody.tombstones.length, 1);
  assert.equal(pullBody.tombstones[0].entityId, sessionId);
  assert.equal(pullBody.tombstones[0].entityType, 'session');
  assert.equal(pullBody.tombstones[0].deletedAt, '2026-09-21T11:30:00.000Z');
});
