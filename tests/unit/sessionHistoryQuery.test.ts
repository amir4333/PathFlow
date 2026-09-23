/**
 * Session History & Filtering Unit Tests (Phase 9C-1)
 *
 * Verifies:
 * 1. Empty filter returns all completed sessions.
 * 2. Date range filtering (inclusive start and end days).
 * 3. Single-day filtering (full 24-hour coverage without off-by-one errors).
 * 4. Task filtering (isolated to selected task).
 * 5. Roadmap filtering (encompasses all tasks under the roadmap).
 * 6. Combined filters (date range + task + roadmap).
 * 7. Clear/empty filters (restores complete history).
 * 8. Deterministic newest-first sorting (canonical timestamps).
 * 9. Total session count aggregation.
 * 10. Total duration aggregation (minutes and hours/minutes breakdown).
 * 11. Jalali/Gregorian date-range behavior (Jalali 1405-06-31 maps to 2026-09-22).
 * 12. Existing session duration calculations remain unchanged.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import {
  calculateDurationMinutes,
} from '../../src/domain';

import {
  PathFlowDB,
  createLocalRepositories,
} from '../../src/data';

import {
  createApplicationServices,
  ValidationError,
  NotFoundError,
} from '../../src/application';

import {
  resolveDateRangeBoundaries,
  jalaliToGregorian,
  gregorianToJalali,
  toAsciiDigits,
} from '../../src/application/sessions/dateRangeResolution';

function setupServices(dbName = `test_p9c1_${Date.now()}_${Math.random()}`) {
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

test('1. Empty filter returns all completed sessions', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Distributed Systems' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Consensus' });
  const taskA = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Raft Paper' });
  const taskB = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Paxos Proof' });

  await services.sessions.createManualSession({
    taskId: taskA.id,
    startedAt: '2026-09-18T10:00:00.000Z',
    endedAt: '2026-09-18T10:45:00.000Z',
  });

  await services.sessions.createManualSession({
    taskId: taskB.id,
    startedAt: '2026-09-19T11:00:00.000Z',
    endedAt: '2026-09-19T12:00:00.000Z',
  });

  // Query with empty filter object
  const resultEmpty = await services.sessions.querySessionHistory({});
  assert.equal(resultEmpty.totalSessions, 2);
  assert.equal(resultEmpty.sessions.length, 2);

  // Query without any parameters
  const resultDefault = await services.sessions.querySessionHistory();
  assert.equal(resultDefault.totalSessions, 2);
  assert.equal(resultDefault.sessions.length, 2);
});

test('2. Date range filtering: inclusive start and end boundaries', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Algorithms' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Graph Theory' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Dijkstra' });

  // Day 1: Sep 18
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-18T15:00:00.000Z',
    endedAt: '2026-09-18T16:00:00.000Z', // 60m
  });

  // Day 2: Sep 19
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-19T09:00:00.000Z',
    endedAt: '2026-09-19T09:45:00.000Z', // 45m
  });

  // Day 3: Sep 20
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-20T14:00:00.000Z',
    endedAt: '2026-09-20T15:30:00.000Z', // 90m
  });

  // Day 4: Sep 21
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T18:00:00.000Z',
    endedAt: '2026-09-21T19:00:00.000Z', // 60m
  });

  // Filter Sep 19 to Sep 20 inclusive
  const rangeResult = await services.sessions.querySessionHistory({
    startDate: '2026-09-19',
    endDate: '2026-09-20',
  });

  assert.equal(rangeResult.totalSessions, 2);
  assert.equal(rangeResult.totalMinutes, 135);
  const dates = rangeResult.sessions.map((s) => s.startedAt.split('T')[0]);
  assert.ok(dates.includes('2026-09-19'));
  assert.ok(dates.includes('2026-09-20'));
  assert.ok(!dates.includes('2026-09-18'));
  assert.ok(!dates.includes('2026-09-21'));
});

test('3. Single-day filtering: encompasses the full 24-hour day without off-by-one errors', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Graphics' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Shaders' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Raymarching' });

  // Early morning of Sep 20
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-20T01:15:00.000Z',
    endedAt: '2026-09-20T02:00:00.000Z', // 45m
  });

  // Late evening of Sep 20
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-20T23:30:00.000Z',
    endedAt: '2026-09-20T23:55:00.000Z', // 25m
  });

  // Day before (Sep 19 23:00:00Z)
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-19T23:00:00.000Z',
    endedAt: '2026-09-19T23:50:00.000Z',
  });

  // Day after (Sep 21 00:05:00Z)
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T00:05:00.000Z',
    endedAt: '2026-09-21T00:40:00.000Z',
  });

  // Single-day query for Sep 20 (both start and end are 2026-09-20)
  const singleDayResult = await services.sessions.querySessionHistory({
    startDate: '2026-09-20',
    endDate: '2026-09-20',
  });

  assert.equal(singleDayResult.totalSessions, 2);
  assert.equal(singleDayResult.totalMinutes, 70); // 45 + 25
  for (const s of singleDayResult.sessions) {
    assert.ok(s.startedAt.startsWith('2026-09-20'));
  }
});

test('4. Task filtering: isolates history to selected Task', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Game Engine' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Physics' });
  const taskRigid = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Rigid Body Solver' });
  const taskCollision = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Broadphase Sweep' });

  await services.sessions.createManualSession({
    taskId: taskRigid.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T11:00:00.000Z',
  });

  await services.sessions.createManualSession({
    taskId: taskCollision.id,
    startedAt: '2026-09-21T13:00:00.000Z',
    endedAt: '2026-09-21T14:30:00.000Z',
  });

  const rigidHistory = await services.sessions.querySessionHistory({ taskId: taskRigid.id });
  assert.equal(rigidHistory.totalSessions, 1);
  assert.equal(rigidHistory.sessions[0].taskId, taskRigid.id);

  const collisionHistory = await services.sessions.querySessionHistory({ taskId: taskCollision.id });
  assert.equal(collisionHistory.totalSessions, 1);
  assert.equal(collisionHistory.sessions[0].taskId, taskCollision.id);

  // Reject non-existent task ID
  await assert.rejects(
    services.sessions.querySessionHistory({ taskId: 'non-existent-id' }),
    (err: unknown) => err instanceof NotFoundError
  );
});

test('5. Roadmap filtering: returns sessions belonging to all Tasks under that Roadmap', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Degree Completion' });
  const roadmapAcademic = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Academic Learning' });
  const roadmapGame = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Game Systems Lab' });

  const taskAcad1 = await services.tasks.createTask({ roadmapId: roadmapAcademic.id, title: 'Operating Systems' });
  const taskAcad2 = await services.tasks.createTask({ roadmapId: roadmapAcademic.id, title: 'Compilers' });
  const taskGame1 = await services.tasks.createTask({ roadmapId: roadmapGame.id, title: 'Inventory System' });

  // Academic sessions
  await services.sessions.createManualSession({
    taskId: taskAcad1.id,
    startedAt: '2026-09-20T08:00:00.000Z',
    endedAt: '2026-09-20T09:30:00.000Z', // 90m
  });
  await services.sessions.createManualSession({
    taskId: taskAcad2.id,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T11:00:00.000Z', // 60m
  });

  // Game Lab session
  await services.sessions.createManualSession({
    taskId: taskGame1.id,
    startedAt: '2026-09-20T14:00:00.000Z',
    endedAt: '2026-09-20T16:00:00.000Z', // 120m
  });

  // Query academic roadmap
  const acadHistory = await services.sessions.querySessionHistory({ roadmapId: roadmapAcademic.id });
  assert.equal(acadHistory.totalSessions, 2);
  assert.equal(acadHistory.totalMinutes, 150);
  assert.ok(acadHistory.sessions.every((s) => s.taskId === taskAcad1.id || s.taskId === taskAcad2.id));

  // Query game lab roadmap
  const gameHistory = await services.sessions.querySessionHistory({ roadmapId: roadmapGame.id });
  assert.equal(gameHistory.totalSessions, 1);
  assert.equal(gameHistory.totalMinutes, 120);
  assert.equal(gameHistory.sessions[0].taskId, taskGame1.id);

  // Reject non-existent roadmap ID
  await assert.rejects(
    services.sessions.querySessionHistory({ roadmapId: 'non-existent-roadmap' }),
    (err: unknown) => err instanceof NotFoundError
  );
});

test('6. Combined filters: Roadmap + Task + Date Range', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Fullstack' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Backend' });
  const taskTarget = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Auth' });
  const taskOther = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Database' });

  // Target task on target date
  await services.sessions.createManualSession({
    taskId: taskTarget.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T11:00:00.000Z', // 60m
  });

  // Target task outside date range
  await services.sessions.createManualSession({
    taskId: taskTarget.id,
    startedAt: '2026-09-19T10:00:00.000Z',
    endedAt: '2026-09-19T11:00:00.000Z',
  });

  // Other task inside date range
  await services.sessions.createManualSession({
    taskId: taskOther.id,
    startedAt: '2026-09-21T14:00:00.000Z',
    endedAt: '2026-09-21T15:00:00.000Z',
  });

  // Combined query: roadmap + target task + target date
  const combinedResult = await services.sessions.querySessionHistory({
    roadmapId: roadmap.id,
    taskId: taskTarget.id,
    startDate: '2026-09-21',
    endDate: '2026-09-21',
  });

  assert.equal(combinedResult.totalSessions, 1);
  assert.equal(combinedResult.totalMinutes, 60);
  assert.equal(combinedResult.sessions[0].taskId, taskTarget.id);
  assert.ok(combinedResult.sessions[0].startedAt.startsWith('2026-09-21'));
});

test('7. Clear/empty filters restores complete history', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Dev' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Sprint' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Task 1' });

  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T11:00:00.000Z',
  });
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T11:00:00.000Z',
  });

  // Filter with no match
  const filteredEmpty = await services.sessions.querySessionHistory({
    startDate: '2026-09-10',
    endDate: '2026-09-11',
  });
  assert.equal(filteredEmpty.totalSessions, 0);

  // Clear filters
  const cleared = await services.sessions.querySessionHistory({});
  assert.equal(cleared.totalSessions, 2);
});

test('8. Newest-first sorting: sessions are sorted canonically by startedAt descending', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Timeline' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'History' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Milestones' });

  // Create in mixed order
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-19T10:00:00.000Z',
    endedAt: '2026-09-19T10:30:00.000Z',
  });
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T10:30:00.000Z',
  });
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T10:30:00.000Z',
  });

  const history = await services.sessions.querySessionHistory();
  assert.equal(history.totalSessions, 3);
  assert.equal(history.sessions[0].startedAt, '2026-09-21T10:00:00.000Z');
  assert.equal(history.sessions[1].startedAt, '2026-09-20T10:00:00.000Z');
  assert.equal(history.sessions[2].startedAt, '2026-09-19T10:00:00.000Z');
});

test('9. Total session count: matches result sessions length accurately', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Metrics' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Counting' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Item' });

  for (let i = 0; i < 5; i++) {
    await services.sessions.createManualSession({
      taskId: task.id,
      startedAt: `2026-09-18T${10 + i}:00:00.000Z`,
      endedAt: `2026-09-18T${10 + i}:30:00.000Z`,
    });
  }

  const res = await services.sessions.querySessionHistory();
  assert.equal(res.totalSessions, 5);
  assert.equal(res.sessions.length, 5);
});

test('10. Total duration: computes exact minutes and hours/minutes breakdown', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Hours' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Summary' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Aggregator' });

  // 1h 30m (90m) + 50m + 45m = 185m = 3h 5m
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T08:00:00.000Z',
    endedAt: '2026-09-21T09:30:00.000Z', // 90m
  });
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T10:50:00.000Z', // 50m
  });
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T12:00:00.000Z',
    endedAt: '2026-09-21T12:45:00.000Z', // 45m
  });

  const res = await services.sessions.querySessionHistory();
  assert.equal(res.totalMinutes, 185);
  assert.equal(res.totalHoursAndMinutes.hours, 3);
  assert.equal(res.totalHoursAndMinutes.minutes, 5);
});

test('11. Jalali/Gregorian date-range behavior: maps Jalali calendar days to exact canonical ISO boundaries', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Calendar Sync' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Bilingual' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Precision Time' });

  // Reference: 2026-09-21 14:30:00 UTC
  // In Jalali: 30 Shahrivar 1405 (1405-06-30)
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T14:30:00.000Z',
    endedAt: '2026-09-21T15:30:00.000Z', // 60m
  });

  // Query using Gregorian date
  const gregResult = await services.sessions.querySessionHistory({
    startDate: '2026-09-21',
    endDate: '2026-09-21',
  });
  assert.equal(gregResult.totalSessions, 1);
  assert.equal(gregResult.totalMinutes, 60);

  // Query using Jalali date format '1405-06-30'
  const jalaliResult = await services.sessions.querySessionHistory({
    startDate: '1405-06-30',
    endDate: '1405-06-30',
  });
  assert.equal(jalaliResult.totalSessions, 1);
  assert.equal(jalaliResult.totalMinutes, 60);

  // Query using Persian numerals: '۱۴۰۵-۰۶-۳۰'
  const persianNumeralResult = await services.sessions.querySessionHistory({
    startDate: '۱۴۰۵-۰۶-۳۰',
    endDate: '۱۴۰۵-۰۶-۳۰',
  });
  assert.equal(persianNumeralResult.totalSessions, 1);
  assert.equal(persianNumeralResult.totalMinutes, 60);

  // Verify internal conversion helpers
  const convertedGreg = jalaliToGregorian(1405, 6, 30);
  assert.deepEqual(convertedGreg, { gy: 2026, gm: 9, gd: 21 });

  const convertedJalali = gregorianToJalali(2026, 9, 21);
  assert.deepEqual(convertedJalali, { jy: 1405, jm: 6, jd: 30 });

  // Verify boundaries resolution
  const boundaries = resolveDateRangeBoundaries('1405-06-30', '1405-06-30');
  assert.equal(boundaries.startIso, '2026-09-21T00:00:00.000Z');
  assert.equal(boundaries.endIso, '2026-09-21T23:59:59.999Z');
});

test('12. Existing session duration calculations remain unchanged', () => {
  const start = '2026-09-21T10:00:00.000Z';
  const end = '2026-09-21T11:45:00.000Z';

  // calculateDurationMinutes is pure domain arithmetic
  const duration = calculateDurationMinutes(start, end);
  assert.equal(duration, 105);

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  assert.equal(Math.round((endMs - startMs) / 60000), 105);
});

test('Error validation: start date after end date triggers ValidationError', async () => {
  const { services } = setupServices();

  await assert.rejects(
    services.sessions.querySessionHistory({
      startDate: '2026-09-22',
      endDate: '2026-09-20',
    }),
    (err: unknown) => err instanceof ValidationError
  );
});
