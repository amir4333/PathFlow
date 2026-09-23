/**
 * Active Session Timer Unit & Integration Tests (Phase 9A)
 *
 * Verifies:
 * 1. Starting a session creates and persists the active session.
 * 2. Active session can be restored across database re-initialization (refresh simulation).
 * 3. Elapsed time is calculated correctly and deterministically from timestamps.
 * 4. Completing a session persists the final duration and clears the active session.
 * 5. A second active session cannot be created when one is already running (conflict prevention).
 * 6. Discarding an active session clears active state without creating historical record.
 * 7. Error handling for non-existent tasks and missing active sessions.
 * 8. Formatted elapsed time helper accuracy (MM:SS, HH:MM:SS).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import {
  createGoal,
  createRoadmap,
  createTask,
  calculateActiveSessionElapsedSeconds,
  createTimestamp,
} from '../../src/domain';

import {
  PathFlowDB,
  createLocalRepositories,
  ActiveSessionConflictError,
} from '../../src/data';

import { createApplicationServices } from '../../src/application';
import { formatElapsedSeconds } from '../../src/features/sessions/ActiveSessionContext';

function setupServices(dbName = `test_p9a_${Date.now()}_${Math.random()}`) {
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

test('Active Session Timer: Starting a session creates and persists the active session', async () => {
  const { db, services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Engine Mastery' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Milestone 1' });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Implement Timer Component',
    estimatedMinutes: 45,
  });

  // Verify initial state is empty
  const initialActive = await services.sessions.getActiveSession();
  assert.equal(initialActive, null);

  // Start active session
  const startTime = createTimestamp('2026-09-22T14:00:00.000Z');
  const activeSession = await services.sessions.startSession(task.id, startTime);

  assert.ok(activeSession.id);
  assert.equal(activeSession.taskId, task.id);
  assert.equal(activeSession.startedAt, startTime);

  // Check persisted in database directly
  const inDb = await db.activeSession.toCollection().first();
  assert.ok(inDb);
  assert.equal(inDb?.taskId, task.id);
  assert.equal(inDb?.startedAt, startTime);

  await db.close();
});

test('Active Session Timer: Active session can be restored after reload / refresh', async () => {
  const dbName = `test_restore_${Date.now()}_${Math.random()}`;
  const { db: db1, services: services1 } = setupServices(dbName);

  const goal = await services1.goals.createGoal({ title: 'Systems Research' });
  const roadmap = await services1.roadmaps.createRoadmap({ goalId: goal.id, title: 'Phase 1' });
  const task = await services1.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Core Engine Loop',
  });

  const startTime = createTimestamp('2026-09-22T10:00:00.000Z');
  await services1.sessions.startSession(task.id, startTime);

  // Simulate closing tab / refreshing page
  await db1.close();

  // Create new instances connected to the same DB name
  const { db: db2, services: services2 } = setupServices(dbName);

  const restored = await services2.sessions.getActiveSession();
  assert.ok(restored, 'Active session must be restored from IndexedDB');
  assert.equal(restored?.taskId, task.id);
  assert.equal(restored?.startedAt, startTime);

  // Derive elapsed seconds from restored session
  const simulatedCurrentTime = '2026-09-22T10:15:30.000Z'; // 15 mins 30 secs later = 930s
  const elapsed = calculateActiveSessionElapsedSeconds(restored!, simulatedCurrentTime);
  assert.equal(elapsed, 930);
  assert.equal(formatElapsedSeconds(elapsed), '15:30');

  await db2.close();
});

test('Active Session Timer: Elapsed time is calculated deterministically from timestamps', async () => {
  const startTime = '2026-09-22T12:00:00.000Z';
  const dummySession = {
    id: 'test-session-1',
    taskId: 'task-1',
    startedAt: startTime,
  };

  // Exactly 0 seconds
  assert.equal(calculateActiveSessionElapsedSeconds(dummySession, '2026-09-22T12:00:00.000Z'), 0);

  // 45 seconds later
  assert.equal(calculateActiveSessionElapsedSeconds(dummySession, '2026-09-22T12:00:45.000Z'), 45);

  // 5 minutes and 12 seconds later (312 seconds)
  assert.equal(calculateActiveSessionElapsedSeconds(dummySession, '2026-09-22T12:05:12.000Z'), 312);

  // 1 hour, 23 minutes and 45 seconds later (5025 seconds)
  assert.equal(calculateActiveSessionElapsedSeconds(dummySession, '2026-09-22T13:23:45.000Z'), 5025);
});

test('Active Session Timer: Time formatting utility formats MM:SS and HH:MM:SS correctly', () => {
  assert.equal(formatElapsedSeconds(0), '00:00');
  assert.equal(formatElapsedSeconds(9), '00:09');
  assert.equal(formatElapsedSeconds(59), '00:59');
  assert.equal(formatElapsedSeconds(60), '01:00');
  assert.equal(formatElapsedSeconds(75), '01:15');
  assert.equal(formatElapsedSeconds(599), '09:59');
  assert.equal(formatElapsedSeconds(600), '10:00');
  assert.equal(formatElapsedSeconds(3599), '59:59');
  assert.equal(formatElapsedSeconds(3600), '01:00:00');
  assert.equal(formatElapsedSeconds(3665), '01:01:05');
  assert.equal(formatElapsedSeconds(7325), '02:02:05');
});

test('Active Session Timer: Completing a session persists the final duration and clears active state', async () => {
  const { db, services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'AI Systems' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Roadmap Alpha' });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Model Benchmarking',
    estimatedMinutes: 60,
  });

  const startTime = '2026-09-22T08:00:00.000Z';
  const endTime = '2026-09-22T08:45:00.000Z'; // 45 minutes

  await services.sessions.startSession(task.id, startTime);

  // Stop session with explicit end time
  const completedSession = await services.sessions.completeSession(endTime);

  assert.equal(completedSession.taskId, task.id);
  assert.equal(completedSession.startedAt, startTime);
  assert.equal(completedSession.endedAt, endTime);
  assert.equal(completedSession.durationMinutes, 45);

  // Verify active session is cleared
  const activeAfterStop = await services.sessions.getActiveSession();
  assert.equal(activeAfterStop, null);

  const activeInDb = await db.activeSession.toCollection().first();
  assert.equal(activeInDb, undefined);

  // Verify historical session is saved
  const allSessions = await services.sessions.getAllSessions();
  assert.equal(allSessions.length, 1);
  assert.equal(allSessions[0].id, completedSession.id);
  assert.equal(allSessions[0].durationMinutes, 45);

  await db.close();
});

test('Active Session Timer: A second active session cannot be created when one is already running', async () => {
  const { db, services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Academic Project' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Comp Sci' });
  const task1 = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Algorithms Homework',
  });
  const task2 = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Data Structures Lab',
  });

  // Start session for task 1
  await services.sessions.startSession(task1.id);

  // Attempt to start session for task 2 - must reject with ActiveSessionConflictError
  await assert.rejects(
    async () => {
      await services.sessions.startSession(task2.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof ActiveSessionConflictError || (err as any)?.activeTaskId === task1.id);
      return true;
    }
  );

  // Verify task 1 remains the active session
  const currentActive = await services.sessions.getActiveSession();
  assert.equal(currentActive?.taskId, task1.id);

  await db.close();
});

test('Active Session Timer: Discarding an active session clears active state without creating a session record', async () => {
  const { db, services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Game Development' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Physics' });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Rigid Body Solver',
  });

  await services.sessions.startSession(task.id);
  assert.ok(await services.sessions.getActiveSession());

  // Discard
  await services.sessions.discardActiveSession();

  // Active must be null
  assert.equal(await services.sessions.getActiveSession(), null);

  // History must have 0 sessions
  const sessions = await services.sessions.getAllSessions();
  assert.equal(sessions.length, 0);

  await db.close();
});

test('Active Session Timer: Error handling for non-existent tasks and absent active session', async () => {
  const { db, services } = setupServices();

  // Non-existent task
  await assert.rejects(async () => {
    await services.sessions.startSession('non-existent-task-id');
  });

  // Completing when no session is active
  await assert.rejects(async () => {
    await services.sessions.completeSession();
  });

  // Discarding when no session is active
  await assert.rejects(async () => {
    await services.sessions.discardActiveSession();
  });

  await db.close();
});
