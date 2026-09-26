import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../server/src/app';
import { MemoryDatabaseStore } from '../../server/src/db/memoryStore';
import {
  SyncEngine,
  InMemorySyncOutbox,
  HttpRemoteSyncClient,
  createSyncRecordingRepositories,
  TeacherHttpClient,
  registerUser,
} from '../../src/sync';
import {
  PathFlowDB,
  createLocalRepositories,
} from '../../src/data';
import {
  generateEntityId,
  createTimestamp,
  createGoal,
  createRoadmap,
  createTask,
} from '../../src/domain';

test('Integration: Multi-Device Sync & Teacher Access via Real HTTP Wire Client', async () => {
  const store = new MemoryDatabaseStore();
  const server = buildApp({ store });
  const address = await server.listen({ port: 0, host: '127.0.0.1' });

  try {
    // 1. Student registers on server via HTTP
    const session = await registerUser(
      address,
      'multi.device.student@example.com',
      'password123',
      'student'
    );
    const token = session.token;
    const studentId = session.user.id;

    // 2. Setup Device A (Workstation)
    const dbA = new PathFlowDB(`db-device-a-${generateEntityId()}`);
    const rawReposA = createLocalRepositories(dbA);
    const outboxA = new InMemorySyncOutbox();
    const reposA = createSyncRecordingRepositories({
      repositories: rawReposA,
      outbox: outboxA,
      getDeviceId: () => 'device-workstation',
    });
    const clientA = new HttpRemoteSyncClient({
      baseUrl: address,
      getAuthToken: () => token,
    });
    const engineA = new SyncEngine({
      deviceId: 'device-workstation',
      repositories: rawReposA,
      outbox: outboxA,
      remoteClient: clientA,
    });

    // 3. Setup Device B (Laptop)
    const dbB = new PathFlowDB(`db-device-b-${generateEntityId()}`);
    const rawReposB = createLocalRepositories(dbB);
    const outboxB = new InMemorySyncOutbox();
    const reposB = createSyncRecordingRepositories({
      repositories: rawReposB,
      outbox: outboxB,
      getDeviceId: () => 'device-laptop',
    });
    const clientB = new HttpRemoteSyncClient({
      baseUrl: address,
      getAuthToken: () => token,
    });
    const engineB = new SyncEngine({
      deviceId: 'device-laptop',
      repositories: rawReposB,
      outbox: outboxB,
      remoteClient: clientB,
    });

    // 4. Device A creates local data through sync-recording repositories
    const goalA = createGoal({ title: 'Autonomous Robotics Curriculum' });
    const roadmapA = createRoadmap({ goalId: goalA.id, title: 'ROS 2 & Navigation Stack' });
    const taskA = createTask({ roadmapId: roadmapA.id, title: 'Implement SLAM mapping node' });

    await reposA.goals.create(goalA);
    await reposA.roadmaps.create(roadmapA);
    await reposA.tasks.create(taskA);

    // Verify mutations were automatically recorded into Device A's outbox
    assert.equal(await outboxA.getPendingCount(), 3);

    // Device A pushes to server
    const syncResA = await engineA.syncOnce();
    assert.equal(syncResA.pushedCount, 3);
    assert.equal(await outboxA.getPendingCount(), 0);

    // Verify Device B does not have the entities yet
    assert.equal(await rawReposB.goals.getById(goalA.id), null);
    assert.equal(await rawReposB.roadmaps.getById(roadmapA.id), null);
    assert.equal(await rawReposB.tasks.getById(taskA.id), null);

    // 5. Device B pulls from server
    const syncResB = await engineB.syncOnce();
    assert.equal(syncResB.pulledCount, 3);

    // Verify Device B's local IndexedDB now has the entities!
    const pulledGoal = await rawReposB.goals.getById(goalA.id);
    const pulledRoadmap = await rawReposB.roadmaps.getById(roadmapA.id);
    const pulledTask = await rawReposB.tasks.getById(taskA.id);

    assert.ok(pulledGoal);
    assert.equal(pulledGoal.title, 'Autonomous Robotics Curriculum');
    assert.ok(pulledRoadmap);
    assert.equal(pulledRoadmap.title, 'ROS 2 & Navigation Stack');
    assert.ok(pulledTask);
    assert.equal(pulledTask.title, 'Implement SLAM mapping node');

    // 6. Conflict Resolution through real HTTP wire:
    // Device B updates the task to 'completed'
    const nowIso = new Date(Date.now() + 1000).toISOString();
    const updatedTaskB = {
      ...pulledTask,
      status: 'completed' as const,
      completedAt: nowIso,
      updatedAt: nowIso,
    };
    await reposB.tasks.update(updatedTaskB);
    assert.equal(await outboxB.getPendingCount(), 1);

    // Device B pushes update
    await engineB.syncOnce();
    assert.equal(await outboxB.getPendingCount(), 0);

    // Device A pulls update
    await engineA.syncOnce();
    const taskOnA = await rawReposA.tasks.getById(taskA.id);
    assert.ok(taskOnA);
    assert.equal(taskOnA.status, 'completed');

    // 7. Teacher Access Flow over HTTP
    const teacherClient = new TeacherHttpClient(address);

    // Student creates teacher grant with read:goals, read:roadmaps, read:tasks
    const grant = await teacherClient.createGrant(token, {
      label: 'Robotics Lab Advisor',
      permissions: ['read:goals', 'read:roadmaps', 'read:tasks'],
      ttlDays: 14,
    });
    assert.ok(grant.id);
    assert.ok(grant.token);
    assert.equal(grant.role, 'read_only');

    // Teacher reads student goals
    const teacherGoals = await teacherClient.getStudentGoals(studentId, grant.token);
    assert.equal(teacherGoals.length, 1);
    assert.equal(teacherGoals[0].title, 'Autonomous Robotics Curriculum');

    // Teacher reads student tasks
    const teacherTasks = await teacherClient.getStudentTasks(studentId, grant.token);
    assert.equal(teacherTasks.length, 1);
    assert.equal(teacherTasks[0].title, 'Implement SLAM mapping node');

    // Teacher attempts mutation -> rejected by server with 403 Forbidden!
    const mutateResponse = await fetch(`${address}/api/teacher/students/${studentId}/goals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${grant.token}`,
      },
      body: JSON.stringify({ title: 'Unauthorized Teacher Injected Goal' }),
    });
    assert.equal(mutateResponse.status, 403, 'Teacher mutation must be rejected with HTTP 403 Forbidden');

    // Student revokes grant
    const revoked = await teacherClient.revokeGrant(token, grant.id);
    assert.equal(revoked.isActive, false);

    // Teacher query after revocation is rejected with HTTP 401/403
    await assert.rejects(
      async () => {
        await teacherClient.getStudentGoals(studentId, grant.token);
      },
      (err: any) => {
        assert.match(err.message, /revoked/i);
        return true;
      }
    );
  } finally {
    await server.close();
  }
});
