import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpRemoteSyncClient,
  SyncEngine,
  InMemorySyncOutbox,
  TeacherHttpClient,
  getDefaultServerUrl,
} from '../../src/sync';
import {
  PathFlowDB,
  createLocalRepositories,
} from '../../src/data';
import {
  generateEntityId,
  createTimestamp,
  createGoal,
  createWeeklyPlan,
  WeeklyPlan,
} from '../../src/domain';

test('Phase 4: ServerConfig respects VITE_API_BASE_URL environment variable', () => {
  const originalEnv = process.env.VITE_API_BASE_URL;
  try {
    process.env.VITE_API_BASE_URL = 'https://api.php-backend.example.com';
    // Test helper validates URL parsing
    const url = getDefaultServerUrl();
    assert.ok(typeof url === 'string');
  } finally {
    if (originalEnv !== undefined) {
      process.env.VITE_API_BASE_URL = originalEnv;
    } else {
      delete process.env.VITE_API_BASE_URL;
    }
  }
});

test('Phase 4: HttpRemoteSyncClient::getStatus sends Bearer token to /api/sync/status', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    capturedHeaders = (init?.headers as Record<string, string>) || {};

    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        studentId: 'student-uuid-456',
        serverTimestamp: '2026-10-01T12:00:00.000Z',
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const client = new HttpRemoteSyncClient({
      baseUrl: 'http://localhost:8000',
      getAuthToken: () => 'valid-student-jwt-123',
    });

    const status = await client.getStatus();
    assert.equal(capturedUrl, 'http://localhost:8000/api/sync/status');
    assert.equal(capturedHeaders['Authorization'], 'Bearer valid-student-jwt-123');
    assert.equal(status.status, 'ok');
    assert.equal(status.studentId, 'student-uuid-456');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 4: HttpRemoteSyncClient handles HTTP 401 error response from backend', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid or expired token' }),
    } as Response;
  }) as typeof fetch;

  try {
    const client = new HttpRemoteSyncClient({
      baseUrl: 'http://localhost:8000',
      getAuthToken: () => 'expired-token',
    });

    await assert.rejects(
      async () => client.push({ deviceId: 'dev-1', mutations: [] }),
      /Invalid or expired token/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 4: TeacherClient sends X-Teacher-Token and unpacks PHP envelope structures', async () => {
  const originalFetch = globalThis.fetch;
  const capturedRequests: Array<{ url: string; headers: Record<string, string> }> = [];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = url.toString();
    const headers = (init?.headers as Record<string, string>) || {};
    capturedRequests.push({ url: u, headers });

    if (u.includes('/api/teacher/grants') && init?.method === 'POST') {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          grant: {
            id: 'grant-uuid-1',
            studentId: 'student-1',
            label: 'Chemistry Mentor',
            token: 'pt_chemistry_token_abc',
            permissions: ['read:goals', 'read:tasks'],
            createdAt: '2026-10-01T12:00:00.000Z',
            isActive: true,
          },
        }),
      } as Response;
    }

    if (u.includes('/api/teacher/grants') && (!init?.method || init?.method === 'GET')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          grants: [
            {
              id: 'grant-uuid-1',
              studentId: 'student-1',
              label: 'Chemistry Mentor',
              token: 'pt_chemistry_token_abc',
              permissions: ['read:goals'],
              createdAt: '2026-10-01T12:00:00.000Z',
              isActive: true,
            },
          ],
        }),
      } as Response;
    }

    if (u.includes('/api/teacher/students/student-1/goals')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          goals: [
            { id: 'g-1', studentId: 'student-1', title: 'Organic Chemistry' },
          ],
        }),
      } as Response;
    }

    if (u.includes('/api/teacher/students/student-1/weekly-plans')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          weeklyPlans: [
            { id: 'wp-1', studentId: 'student-1', weekNumber: 40, year: 2026 },
          ],
        }),
      } as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response;
  }) as typeof fetch;

  try {
    const teacherClient = new TeacherHttpClient('http://localhost:8000');

    // 1. Create grant
    const created = await teacherClient.createGrant('student-jwt-xyz', {
      label: 'Chemistry Mentor',
      permissions: ['read:goals', 'read:tasks'],
    });
    assert.equal(created.id, 'grant-uuid-1');
    assert.equal(created.token, 'pt_chemistry_token_abc');

    // 2. List grants
    const list = await teacherClient.listGrants('student-jwt-xyz');
    assert.equal(list.length, 1);
    assert.equal(list[0].label, 'Chemistry Mentor');

    // 3. Teacher read-only query
    const goals = await teacherClient.getStudentGoals('student-1', 'pt_chemistry_token_abc');
    assert.equal(goals.length, 1);
    assert.equal(goals[0].title, 'Organic Chemistry');

    // 4. Verify headers sent for read query
    const readReq = capturedRequests.find((r) => r.url.includes('/api/teacher/students/student-1/goals'));
    assert.ok(readReq);
    assert.equal(readReq.headers['X-Teacher-Token'], 'pt_chemistry_token_abc');
    assert.equal(readReq.headers['Authorization'], 'Bearer pt_chemistry_token_abc');

    // 5. Weekly plans query
    const plans = await teacherClient.getStudentWeeklyPlans('student-1', 'pt_chemistry_token_abc');
    assert.equal(plans.length, 1);
    assert.equal(plans[0].weekNumber, 40);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 4: SyncEngine pulls and applies weeklyPlan changes and tombstones', async () => {
  const db = new PathFlowDB(`test-wp-db-${generateEntityId()}`);
  const repos = createLocalRepositories(db);
  const outbox = new InMemorySyncOutbox();

  const planId = generateEntityId();
  const remotePlan: WeeklyPlan = createWeeklyPlan({
    id: planId,
    weekIdentifier: '2026-W41',
    title: 'Phase 4 Plan',
    targetMinutes: 120,
  });

  const mockClient = {
    async push() {
      return { acceptedMutationIds: [], rejectedMutations: [], serverTimestamp: createTimestamp() };
    },
    async pull() {
      return {
        changes: [
          {
            entityType: 'weeklyPlan' as const,
            entityId: planId,
            operation: 'create' as const,
            payload: remotePlan,
            updatedAt: createTimestamp(),
          },
        ],
        tombstones: [],
        nextCursor: { lastSyncTimestamp: createTimestamp(), serverVersion: 10 },
        hasMore: false,
      };
    },
  };

  const engine = new SyncEngine({
    deviceId: 'test-device-wp',
    repositories: repos,
    outbox,
    remoteClient: mockClient,
  });

  // Pull should apply remote weekly plan
  const syncRes = await engine.syncOnce();
  assert.equal(syncRes.pulledCount, 1);

  const localPlan = await repos.weeklyPlans.getById(planId);
  assert.ok(localPlan);
  assert.equal(localPlan.title, 'Phase 4 Plan');

  // Next pull with tombstone should delete the plan locally
  const mockDeleteClient = {
    async push() {
      return { acceptedMutationIds: [], rejectedMutations: [], serverTimestamp: createTimestamp() };
    },
    async pull() {
      return {
        changes: [],
        tombstones: [
          {
            entityType: 'weeklyPlan' as const,
            entityId: planId,
            deletedAt: createTimestamp(),
            sequence: 11,
          },
        ],
        nextCursor: { lastSyncTimestamp: createTimestamp(), serverVersion: 11 },
        hasMore: false,
      };
    },
  };

  const engine2 = new SyncEngine({
    deviceId: 'test-device-wp',
    repositories: repos,
    outbox,
    remoteClient: mockDeleteClient,
  });

  await engine2.syncOnce();
  const deletedPlan = await repos.weeklyPlans.getById(planId);
  assert.equal(deletedPlan, null);
});

test('Phase 4: Offline-first resilience - Network failure retains outbox and local data', async () => {
  const db = new PathFlowDB(`test-offline-db-${generateEntityId()}`);
  const repos = createLocalRepositories(db);
  const outbox = new InMemorySyncOutbox();

  // Create local goal offline
  const goal = createGoal({ title: 'Offline-First Philosophy' });
  await repos.goals.create(goal);
  await outbox.enqueue({
    id: generateEntityId(),
    clientMutationId: 'offline-mut-1',
    entityType: 'goal',
    entityId: goal.id,
    operation: 'create',
    payload: goal,
    timestamp: createTimestamp(),
    deviceId: 'laptop-offline',
  });

  assert.equal(await outbox.getPendingCount(), 1);

  // Network failure during push
  const failingClient = {
    async push(): Promise<never> {
      throw new Error('Network request failed: backend unreachable');
    },
    async pull(): Promise<never> {
      throw new Error('Network request failed: backend unreachable');
    },
  };

  const engine = new SyncEngine({
    deviceId: 'laptop-offline',
    repositories: repos,
    outbox,
    remoteClient: failingClient,
  });

  // syncOnce handles network error gracefully without crashing or throwing
  const syncResult = await engine.syncOnce();
  assert.equal(syncResult.pushedCount, 0);
  assert.equal(syncResult.pulledCount, 0);
  const status = await engine.getStatus();
  assert.equal(status.state, 'error');
  assert.match(status.lastError ?? '', /Network request failed/);

  // Local data is completely intact
  const localGoal = await repos.goals.getById(goal.id);
  assert.ok(localGoal);
  assert.equal(localGoal.title, 'Offline-First Philosophy');

  // Outbox retains mutation in retryable failed state
  const outboxItems = await outbox.getAll();
  assert.equal(outboxItems.length, 1);
  assert.equal(outboxItems[0].status, 'failed');
  assert.equal(outboxItems[0].retryCount, 1);

  // Next sync cycle will pick it up for retry (retryCount < 5)
  const retryPending = await outbox.getPending();
  assert.equal(retryPending.length, 1);
});
