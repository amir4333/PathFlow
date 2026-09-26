import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../server/src/app';
import { MemoryDatabaseStore } from '../../server/src/db/memoryStore';
import { generateEntityId, createTimestamp } from '../../src/domain';

test('Backend Teacher Access: Student grants access and teacher inspects read-only views', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  // 1. Register student
  const regStudent = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'student-teach@example.com', password: 'password123', role: 'student' },
  });
  const student = JSON.parse(regStudent.payload).user;
  const studentToken = JSON.parse(regStudent.payload).token;

  // 2. Student syncs a goal and task
  const goalId = generateEntityId();
  const taskId = generateEntityId();

  await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { authorization: `Bearer ${studentToken}` },
    payload: {
      deviceId: 'dev-1',
      mutations: [
        {
          id: generateEntityId(),
          clientMutationId: 'mut-g-1',
          entityType: 'goal',
          entityId: goalId,
          operation: 'create',
          payload: { title: 'Advanced Algorithms Research' },
          timestamp: createTimestamp(),
        },
        {
          id: generateEntityId(),
          clientMutationId: 'mut-t-1',
          entityType: 'task',
          entityId: taskId,
          operation: 'create',
          payload: { roadmapId: 'rm-1', title: 'Graph Traversal Implementation', status: 'completed' },
          timestamp: createTimestamp(),
        },
      ],
    },
  });

  // 3. Student creates teacher access grant
  const grantRes = await app.inject({
    method: 'POST',
    url: '/api/teacher/grants',
    headers: { authorization: `Bearer ${studentToken}` },
    payload: {
      label: 'Advisor Prof. Knuth',
      permissions: ['read:goals', 'read:tasks', 'read:reports'],
      ttlDays: 30,
    },
  });
  assert.equal(grantRes.statusCode, 201);
  const grant = JSON.parse(grantRes.payload);
  assert.ok(grant.token);
  assert.equal(grant.isActive, true);

  // 4. Teacher uses grant token to inspect goals
  const goalsRes = await app.inject({
    method: 'GET',
    url: `/api/teacher/students/${student.id}/goals`,
    headers: { authorization: `Bearer ${grant.token}` },
  });
  assert.equal(goalsRes.statusCode, 200);
  const goals = JSON.parse(goalsRes.payload);
  assert.equal(goals.length, 1);
  assert.equal(goals[0].title, 'Advanced Algorithms Research');

  // 5. Teacher uses grant token to inspect tasks
  const tasksRes = await app.inject({
    method: 'GET',
    url: `/api/teacher/students/${student.id}/tasks`,
    headers: { authorization: `Bearer ${grant.token}` },
  });
  assert.equal(tasksRes.statusCode, 200);
  const tasks = JSON.parse(tasksRes.payload);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'Graph Traversal Implementation');

  // 6. Teacher accesses reports
  const reportsRes = await app.inject({
    method: 'GET',
    url: `/api/teacher/students/${student.id}/reports`,
    headers: { authorization: `Bearer ${grant.token}` },
  });
  assert.equal(reportsRes.statusCode, 200);
  const report = JSON.parse(reportsRes.payload);
  assert.equal(report.studentId, student.id);
  assert.equal(report.overview.totalGoals, 1);
  assert.equal(report.overview.totalTasks, 1);
});

test('Backend Teacher Access: Rejection on revoked grant, expired grant, and missing permissions', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  // Register student
  const regStudent = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'student-rev@example.com', password: 'password123', role: 'student' },
  });
  const student = JSON.parse(regStudent.payload).user;
  const studentToken = JSON.parse(regStudent.payload).token;

  // Create grant with only 'read:goals'
  const grantRes = await app.inject({
    method: 'POST',
    url: '/api/teacher/grants',
    headers: { authorization: `Bearer ${studentToken}` },
    payload: {
      label: 'Restricted Mentor',
      permissions: ['read:goals'],
    },
  });
  const grant = JSON.parse(grantRes.payload);

  // Attempt to read sessions (missing permission) -> 403
  const missingPermRes = await app.inject({
    method: 'GET',
    url: `/api/teacher/students/${student.id}/sessions`,
    headers: { authorization: `Bearer ${grant.token}` },
  });
  assert.equal(missingPermRes.statusCode, 403);
  assert.ok(JSON.parse(missingPermRes.payload).error.includes('read:sessions'));

  // Revoke grant
  const revokeRes = await app.inject({
    method: 'DELETE',
    url: `/api/teacher/grants/${grant.id}`,
    headers: { authorization: `Bearer ${studentToken}` },
  });
  assert.equal(revokeRes.statusCode, 200);

  // Attempt to read goals after revocation -> 403
  const revokedAccessRes = await app.inject({
    method: 'GET',
    url: `/api/teacher/students/${student.id}/goals`,
    headers: { authorization: `Bearer ${grant.token}` },
  });
  assert.equal(revokedAccessRes.statusCode, 403);
  assert.ok(JSON.parse(revokedAccessRes.payload).error.includes('revoked'));
});

test('Backend Teacher Access: Rejection of ANY mutation operation', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  const regStudent = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'student-nomut@example.com', password: 'password123', role: 'student' },
  });
  const student = JSON.parse(regStudent.payload).user;
  const studentToken = JSON.parse(regStudent.payload).token;

  const grantRes = await app.inject({
    method: 'POST',
    url: '/api/teacher/grants',
    headers: { authorization: `Bearer ${studentToken}` },
    payload: { label: 'Teacher' },
  });
  const grant = JSON.parse(grantRes.payload);

  // POST mutation attempt
  const postRes = await app.inject({
    method: 'POST',
    url: `/api/teacher/students/${student.id}/goals`,
    headers: { authorization: `Bearer ${grant.token}` },
    payload: { title: 'Unauthorized Goal' },
  });
  assert.equal(postRes.statusCode, 403);
  assert.ok(JSON.parse(postRes.payload).error.includes('strictly read-only'));

  // DELETE mutation attempt
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/teacher/students/${student.id}/goals/123`,
    headers: { authorization: `Bearer ${grant.token}` },
  });
  assert.equal(deleteRes.statusCode, 403);
  assert.ok(JSON.parse(deleteRes.payload).error.includes('strictly read-only'));
});
