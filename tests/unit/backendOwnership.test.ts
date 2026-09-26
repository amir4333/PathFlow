import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../server/src/app';
import { MemoryDatabaseStore } from '../../server/src/db/memoryStore';
import { generateEntityId, createTimestamp } from '../../src/domain';

test('Backend Ownership: Strict data isolation between Student A and Student B', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  // 1. Register Student A
  const regA = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'studentA@example.com', password: 'password123', role: 'student' },
  });
  const tokenA = JSON.parse(regA.payload).token;

  // 2. Register Student B
  const regB = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'studentB@example.com', password: 'password123', role: 'student' },
  });
  const tokenB = JSON.parse(regB.payload).token;

  // 3. Student A pushes a Goal
  const goalId = generateEntityId();
  const pushA = await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      deviceId: 'device-laptop-A',
      mutations: [
        {
          id: generateEntityId(),
          clientMutationId: 'mut-a-1',
          entityType: 'goal',
          entityId: goalId,
          operation: 'create',
          payload: { title: 'Secret Project of Student A' },
          timestamp: createTimestamp(),
        },
      ],
    },
  });
  assert.equal(pushA.statusCode, 200);

  // 4. Student B pulls changes
  const pullB = await app.inject({
    method: 'POST',
    url: '/api/sync/pull',
    headers: { authorization: `Bearer ${tokenB}` },
    payload: { cursor: null },
  });
  assert.equal(pullB.statusCode, 200);
  const pullBBody = JSON.parse(pullB.payload);

  // Student B MUST NOT see Student A's goal!
  assert.equal(pullBBody.changes.length, 0);
  assert.equal(pullBBody.tombstones.length, 0);

  // 5. Student A pulls changes and sees their goal
  const pullA = await app.inject({
    method: 'POST',
    url: '/api/sync/pull',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { cursor: null },
  });
  assert.equal(pullA.statusCode, 200);
  const pullABody = JSON.parse(pullA.payload);
  assert.equal(pullABody.changes.length, 1);
  assert.equal(pullABody.changes[0].entityId, goalId);
  assert.equal(pullABody.changes[0].payload.title, 'Secret Project of Student A');
});
