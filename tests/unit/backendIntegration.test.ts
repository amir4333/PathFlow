import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../server/src/app';
import { MemoryDatabaseStore } from '../../server/src/db/memoryStore';
import {
  SyncEngine,
  InMemorySyncOutbox,
  RemoteSyncClient,
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse,
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

/**
 * An in-process Fastify adapter implementing RemoteSyncClient via app.inject
 */
class FastifyInjectSyncClient implements RemoteSyncClient {
  constructor(private readonly app: any, private readonly authToken: string) {}

  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    const res = await this.app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: {
        authorization: `Bearer ${this.authToken}`,
      },
      payload: request,
    });

    if (res.statusCode !== 200) {
      throw new Error(`Sync push failed with HTTP ${res.statusCode}: ${res.payload}`);
    }

    return JSON.parse(res.payload) as SyncPushResponse;
  }

  async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
    const res = await this.app.inject({
      method: 'POST',
      url: '/api/sync/pull',
      headers: {
        authorization: `Bearer ${this.authToken}`,
      },
      payload: request,
    });

    if (res.statusCode !== 200) {
      throw new Error(`Sync pull failed with HTTP ${res.statusCode}: ${res.payload}`);
    }

    return JSON.parse(res.payload) as SyncPullResponse;
  }
}

test('Integration: End-to-end two-device sync flow (Laptop -> Server -> Mobile)', async () => {
  const store = new MemoryDatabaseStore();
  const server = buildApp({ store });

  // 1. Student registers on server
  const regRes = await server.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: 'student.e2e@example.com',
      password: 'password123',
      role: 'student',
    },
  });
  assert.equal(regRes.statusCode, 201);
  const student = JSON.parse(regRes.payload).user;
  const token = JSON.parse(regRes.payload).token;

  // 2. Set up Device A (Laptop)
  const dbLaptop = new PathFlowDB(`laptop-db-${generateEntityId()}`);
  const reposLaptop = createLocalRepositories(dbLaptop);
  const outboxLaptop = new InMemorySyncOutbox();
  const clientLaptop = new FastifyInjectSyncClient(server, token);
  const engineLaptop = new SyncEngine({
    deviceId: 'device-laptop',
    repositories: reposLaptop,
    outbox: outboxLaptop,
    remoteClient: clientLaptop,
  });

  // 3. Set up Device B (Mobile)
  const dbMobile = new PathFlowDB(`mobile-db-${generateEntityId()}`);
  const reposMobile = createLocalRepositories(dbMobile);
  const outboxMobile = new InMemorySyncOutbox();
  const clientMobile = new FastifyInjectSyncClient(server, token);
  const engineMobile = new SyncEngine({
    deviceId: 'device-mobile',
    repositories: reposMobile,
    outbox: outboxMobile,
    remoteClient: clientMobile,
  });

  // 4. Laptop creates a Goal, Roadmap, and Task offline in local repositories
  const goal = createGoal({ title: 'Master Rust and Distributed Systems' });
  const roadmap = createRoadmap({ goalId: goal.id, title: 'Consensus Systems Milestone' });
  const task = createTask({ roadmapId: roadmap.id, title: 'Build Raft Consensus Engine' });

  await reposLaptop.goals.create(goal);
  await reposLaptop.roadmaps.create(roadmap);
  await reposLaptop.tasks.create(task);

  // Enqueue mutations into Laptop's outbox
  await outboxLaptop.enqueue({
    id: generateEntityId(),
    clientMutationId: 'laptop-mut-1',
    entityType: 'goal',
    entityId: goal.id,
    operation: 'create',
    payload: goal,
    timestamp: createTimestamp(),
    deviceId: 'device-laptop',
  });

  await outboxLaptop.enqueue({
    id: generateEntityId(),
    clientMutationId: 'laptop-mut-2',
    entityType: 'roadmap',
    entityId: roadmap.id,
    operation: 'create',
    payload: roadmap,
    timestamp: createTimestamp(),
    deviceId: 'device-laptop',
  });

  await outboxLaptop.enqueue({
    id: generateEntityId(),
    clientMutationId: 'laptop-mut-3',
    entityType: 'task',
    entityId: task.id,
    operation: 'create',
    payload: task,
    timestamp: createTimestamp(),
    deviceId: 'device-laptop',
  });

  assert.equal(await outboxLaptop.getPendingCount(), 3);

  // 5. Laptop connects to network and syncs (pushes to server)
  const laptopSync = await engineLaptop.syncOnce();
  assert.equal(laptopSync.pushedCount, 3);
  assert.equal(await outboxLaptop.getPendingCount(), 0);

  // At this point, Mobile does not have the goal, roadmap, or task yet
  assert.equal(await reposMobile.goals.getById(goal.id), null);
  assert.equal(await reposMobile.roadmaps.getById(roadmap.id), null);
  assert.equal(await reposMobile.tasks.getById(task.id), null);

  // 6. Mobile connects to network and syncs (pulls from server)
  const mobileSync = await engineMobile.syncOnce();
  assert.equal(mobileSync.pulledCount, 3);

  // 7. Verify Mobile now has the synchronized Goal and Task in its local IndexedDB!
  const syncedGoal = await reposMobile.goals.getById(goal.id);
  const syncedTask = await reposMobile.tasks.getById(task.id);

  assert.ok(syncedGoal);
  assert.equal(syncedGoal.title, 'Master Rust and Distributed Systems');

  assert.ok(syncedTask);
  assert.equal(syncedTask.title, 'Build Raft Consensus Engine');

  // 8. Teacher Access Flow
  // Student issues teacher grant
  const grantRes = await server.inject({
    method: 'POST',
    url: '/api/teacher/grants',
    headers: { authorization: `Bearer ${token}` },
    payload: { label: 'Systems Mentor', permissions: ['read:goals', 'read:tasks'] },
  });
  const grant = JSON.parse(grantRes.payload);

  // Teacher accesses student goals
  const teacherGoalsRes = await server.inject({
    method: 'GET',
    url: `/api/teacher/students/${student.id}/goals`,
    headers: { authorization: `Bearer ${grant.token}` },
  });
  assert.equal(teacherGoalsRes.statusCode, 200);
  const teacherGoals = JSON.parse(teacherGoalsRes.payload);
  assert.equal(teacherGoals.length, 1);
  assert.equal(teacherGoals[0].title, 'Master Rust and Distributed Systems');

  // Teacher attempts mutation -> rejected with 403
  const mutateRes = await server.inject({
    method: 'POST',
    url: `/api/teacher/students/${student.id}/goals`,
    headers: { authorization: `Bearer ${grant.token}` },
    payload: { title: 'Malicious Injected Goal' },
  });
  assert.equal(mutateRes.statusCode, 403);
});
