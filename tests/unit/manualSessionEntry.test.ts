/**
 * Manual Session Entry Unit & Integration Tests (Phase 9B)
 *
 * Verifies:
 * 1. Valid manual session creation.
 * 2. Duration calculation derived automatically from timestamps.
 * 3. Invalid start/end ordering (endedAt <= startedAt).
 * 4. Missing / non-existent task handling.
 * 5. Invalid timestamp handling and future session rejection.
 * 6. Persistence through SessionService across DB reconnects.
 * 7. Active-session conflict enforcement (cannot create manual session while active timer is running).
 * 8. History refresh after creation (immediate availability in queries).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import {
  createGoal,
  createRoadmap,
  createTask,
  createTimestamp,
} from '../../src/domain';

import {
  PathFlowDB,
  createLocalRepositories,
} from '../../src/data';

import {
  createApplicationServices,
  ValidationError,
  NotFoundError,
  ActiveSessionConflictError,
} from '../../src/application';

function setupServices(dbName = `test_p9b_${Date.now()}_${Math.random()}`) {
  const db = new PathFlowDB(dbName);
  const repos = createLocalRepositories(db);
  const services = createApplicationServices({
    goals: repos.goals,
    roadmaps: repos.roadmaps,
    tasks: repos.tasks,
    sessions: repos.sessions,
    weeklyPlans: repos.weeklyPlans,
    weeklyPlanItems: repos.weeklyPlanItems,
  });
  return { db, repos, services };
}

test('Manual Session Entry: Valid manual session creation and duration calculation', async () => {
  const { db, services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Distributed Systems' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Consensus Protocols' });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Raft Log Replication',
    estimatedMinutes: 120,
  });

  const startedAt = '2026-09-20T14:00:00.000Z';
  const endedAt = '2026-09-20T15:30:00.000Z'; // 90 minutes

  const session = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt,
    endedAt,
  });

  assert.ok(session.id);
  assert.equal(session.taskId, task.id);
  assert.equal(session.startedAt, startedAt);
  assert.equal(session.endedAt, endedAt);
  assert.equal(session.durationMinutes, 90, 'Duration must be derived accurately as 90 minutes');

  // Verify stored in repository
  const stored = await services.sessions.getSession(session.id);
  assert.ok(stored);
  assert.equal(stored.durationMinutes, 90);

  await db.close();
});

test('Manual Session Entry: Rejects invalid start/end ordering (endedAt <= startedAt)', async () => {
  const { db, services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Algorithms' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Graphs' });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Dijkstra Priority Queue',
  });

  // endedAt before startedAt
  await assert.rejects(
    async () => {
      await services.sessions.createManualSession({
        taskId: task.id,
        startedAt: '2026-09-21T10:00:00.000Z',
        endedAt: '2026-09-21T09:00:00.000Z',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.ok((err as ValidationError).validationErrors.some((e) => e.includes('End time must be after start time')));
      return true;
    }
  );

  // endedAt equal to startedAt (0 minutes)
  await assert.rejects(
    async () => {
      await services.sessions.createManualSession({
        taskId: task.id,
        startedAt: '2026-09-21T10:00:00.000Z',
        endedAt: '2026-09-21T10:00:00.000Z',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      return true;
    }
  );

  await db.close();
});

test('Manual Session Entry: Missing or non-existent task is rejected', async () => {
  const { db, services } = setupServices();

  // Missing taskId (empty)
  await assert.rejects(
    async () => {
      await services.sessions.createManualSession({
        taskId: '',
        startedAt: '2026-09-20T10:00:00.000Z',
        endedAt: '2026-09-20T11:00:00.000Z',
      });
    },
    (err: unknown) => err instanceof ValidationError
  );

  // Non-existent taskId
  await assert.rejects(
    async () => {
      await services.sessions.createManualSession({
        taskId: 'non-existent-task-id-12345',
        startedAt: '2026-09-20T10:00:00.000Z',
        endedAt: '2026-09-20T11:00:00.000Z',
      });
    },
    (err: unknown) => err instanceof NotFoundError
  );

  await db.close();
});

test('Manual Session Entry: Invalid timestamp formats and future sessions are rejected', async () => {
  const { db, services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'AI Systems' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'ML Ops' });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Model Quantization',
  });

  // Malformed date string
  await assert.rejects(
    async () => {
      await services.sessions.createManualSession({
        taskId: task.id,
        startedAt: 'not-a-valid-timestamp',
        endedAt: 'also-invalid',
      });
    },
    (err: unknown) => err instanceof ValidationError
  );

  // Future session (e.g. 5 days in the future)
  const farFutureStart = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const farFutureEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3600000).toISOString();

  await assert.rejects(
    async () => {
      await services.sessions.createManualSession({
        taskId: task.id,
        startedAt: farFutureStart,
        endedAt: farFutureEnd,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.ok((err as ValidationError).validationErrors.some((e) => e.includes('future')));
      return true;
    }
  );

  await db.close();
});

test('Manual Session Entry: Persistence through SessionService across database reconnects', async () => {
  const dbName = `test_manual_persist_${Date.now()}_${Math.random()}`;
  const { db: db1, services: services1 } = setupServices(dbName);

  const goal = await services1.goals.createGoal({ title: 'Compiler Engineering' });
  const roadmap = await services1.roadmaps.createRoadmap({ goalId: goal.id, title: 'Lexer & Parser' });
  const task = await services1.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'AST Construction',
  });

  const startedAt = '2026-09-19T09:00:00.000Z';
  const endedAt = '2026-09-19T10:45:00.000Z'; // 105 minutes

  const created = await services1.sessions.createManualSession({
    taskId: task.id,
    startedAt,
    endedAt,
  });

  assert.equal(created.durationMinutes, 105);

  // Simulate tab refresh / DB reload
  await db1.close();

  const { db: db2, services: services2 } = setupServices(dbName);

  const reloaded = await services2.sessions.getSession(created.id);
  assert.ok(reloaded, 'Manual session must be restored from persistent store');
  assert.equal(reloaded?.taskId, task.id);
  assert.equal(reloaded?.startedAt, startedAt);
  assert.equal(reloaded?.endedAt, endedAt);
  assert.equal(reloaded?.durationMinutes, 105);

  await db2.close();
});

test('Manual Session Entry: Active-session conflict prevents recording manual session while live timer runs', async () => {
  const { db, services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Research' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Literature Review' });
  const taskActive = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Paper Reading (Active)',
  });
  const taskManual = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Notes Compilation (Manual)',
  });

  // 1. Start live active session for taskActive
  await services.sessions.startSession(taskActive.id);

  // 2. Attempt to record manual session for taskManual -> must reject with ActiveSessionConflictError
  await assert.rejects(
    async () => {
      await services.sessions.createManualSession({
        taskId: taskManual.id,
        startedAt: '2026-09-20T08:00:00.000Z',
        endedAt: '2026-09-20T09:30:00.000Z',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ActiveSessionConflictError);
      assert.equal((err as ActiveSessionConflictError).activeTaskId, taskActive.id);
      return true;
    }
  );

  // 3. Verify active timer for taskActive is intact and running
  const runningActive = await services.sessions.getActiveSession();
  assert.ok(runningActive);
  assert.equal(runningActive?.taskId, taskActive.id);

  // 4. Discard or complete active session
  await services.sessions.discardActiveSession();
  assert.equal(await services.sessions.getActiveSession(), null);

  // 5. Now recording manual session must succeed cleanly
  const manual = await services.sessions.createManualSession({
    taskId: taskManual.id,
    startedAt: '2026-09-20T08:00:00.000Z',
    endedAt: '2026-09-20T09:30:00.000Z',
  });
  assert.equal(manual.durationMinutes, 90);
  assert.equal(manual.taskId, taskManual.id);

  await db.close();
});

test('Manual Session Entry: History refresh and availability across queries immediately after creation', async () => {
  const { db, services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Full-Stack Architecture' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Database Optimization' });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Index Tuning',
  });

  // Initially 0 sessions
  assert.equal((await services.sessions.getAllSessions()).length, 0);

  // Create session 1 (earlier today)
  const session1 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-22T08:00:00.000Z',
    endedAt: '2026-09-22T09:15:00.000Z', // 75 mins
  });

  // Create session 2 (yesterday)
  const session2 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T14:00:00.000Z',
    endedAt: '2026-09-21T15:00:00.000Z', // 60 mins
  });

  // Check getAllSessions() returns both
  const all = await services.sessions.getAllSessions();
  assert.equal(all.length, 2);

  // Check listSessionsForTask()
  const forTask = await services.sessions.listSessionsForTask(task.id);
  assert.equal(forTask.length, 2);

  // Check listSessionsForDate()
  const todaySessions = await services.sessions.listSessionsForDate('2026-09-22');
  assert.equal(todaySessions.length, 1);
  assert.equal(todaySessions[0].id, session1.id);
  assert.equal(todaySessions[0].durationMinutes, 75);

  const yesterdaySessions = await services.sessions.listSessionsForDate('2026-09-21');
  assert.equal(yesterdaySessions.length, 1);
  assert.equal(yesterdaySessions[0].id, session2.id);
  assert.equal(yesterdaySessions[0].durationMinutes, 60);

  await db.close();
});
