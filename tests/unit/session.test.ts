/**
 * Session and Time Tracking Unit & Integration Tests (Phase 4)
 *
 * Tests session lifecycle, active session singleton enforcement, manual logging,
 * temporal queries, actual time aggregation, planned vs. actual comparisons,
 * and unified architecture handling both Academic Learning and Game Systems Lab.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import {
  createGoal,
  createRoadmap,
  createTask,
  createWeeklyPlan,
  createWeeklyPlanItem,
  startActiveSession,
  completeActiveSession,
  createSession,
  createManualSession,
  calculateActiveSessionElapsedMinutes,
  calculateActiveSessionElapsedSeconds,
  validateActiveSession,
  validateSession,
  calculateTaskActualMinutes,
  calculateRoadmapActualMinutes,
  calculateGoalActualMinutes,
  calculateWeeklyPlanActualMinutes,
  calculateDateActualMinutes,
  calculateWeekActualMinutes,
  compareTaskPlannedVsActual,
  compareWeeklyPlanPlannedVsActual,
  compareRoadmapPlannedVsActual,
  compareGoalPlannedVsActual,
  calculateDailyActivitySummaries,
  getWeekIdentifier,
  getWeekDateRange,
  createTimestamp,
} from '../../src/domain';

import {
  PathFlowDB,
  createLocalRepositories,
  ActiveSessionConflictError,
  EntityNotFoundError,
  DomainValidationError,
} from '../../src/data';

function setupTestEnv(dbName = `test_session_${Date.now()}_${Math.random()}`) {
  const db = new PathFlowDB(dbName);
  const repos = createLocalRepositories(db);
  return { db, repos };
}

test('Session Lifecycle: Start active session for a task and detect running state', async () => {
  const { repos } = setupTestEnv();

  const goal = await repos.goals.create(createGoal({ title: 'Game Systems Lab' }));
  const roadmap = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Inventory Engine' }));
  const task = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Item Slot Matrix', estimatedMinutes: 90 }));

  // Verify initially no active session
  const initialActive = await repos.sessions.getActiveSession();
  assert.equal(initialActive, null);

  // Start active session
  const startedAt = '2026-09-20T14:00:00.000Z';
  const active = await repos.sessions.startActiveSession(task.id, startedAt);

  assert.ok(active.id);
  assert.equal(active.taskId, task.id);
  assert.equal(active.startedAt, startedAt);

  // Query active session from repository
  const fetchedActive = await repos.sessions.getActiveSession();
  assert.ok(fetchedActive);
  assert.equal(fetchedActive.id, active.id);
  assert.equal(fetchedActive.taskId, task.id);
  assert.equal(fetchedActive.startedAt, startedAt);
});

test('Session Lifecycle: Derives elapsed time dynamically from start timestamp without continuous writes', () => {
  const startedAt = '2026-09-20T10:00:00.000Z';
  const active = startActiveSession('task-123', startedAt);

  // 15 minutes later
  const asOf15Min = '2026-09-20T10:15:00.000Z';
  const elapsedMinutes = calculateActiveSessionElapsedMinutes(active, asOf15Min);
  const elapsedSeconds = calculateActiveSessionElapsedSeconds(active, asOf15Min);

  assert.equal(elapsedMinutes, 15);
  assert.equal(elapsedSeconds, 900);

  // 75 minutes later
  const asOf75Min = '2026-09-20T11:15:30.000Z';
  assert.equal(calculateActiveSessionElapsedMinutes(active, asOf75Min), 76); // rounds 75.5 to 76
  assert.equal(calculateActiveSessionElapsedSeconds(active, asOf75Min), 4530);
});

test('Session Lifecycle: Stop active session, calculate duration from timestamps, and persist completed historical record', async () => {
  const { repos } = setupTestEnv();

  const goal = await repos.goals.create(createGoal({ title: 'Academic Learning' }));
  const roadmap = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Data Structures' }));
  const task = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Binary Search Trees', estimatedMinutes: 120 }));

  const startedAt = '2026-09-20T18:10:00.000Z';
  await repos.sessions.startActiveSession(task.id, startedAt);

  // Stop session at 19:25 (75 minutes duration)
  const endedAt = '2026-09-20T19:25:00.000Z';
  const completed = await repos.sessions.stopActiveSession(endedAt);

  assert.ok(completed.id);
  assert.equal(completed.taskId, task.id);
  assert.equal(completed.startedAt, startedAt);
  assert.equal(completed.endedAt, endedAt);
  assert.equal(completed.durationMinutes, 75);

  // Active session must now be cleared
  const activeAfterStop = await repos.sessions.getActiveSession();
  assert.equal(activeAfterStop, null);

  // Session must be persisted in historical repository
  const historical = await repos.sessions.getById(completed.id);
  assert.ok(historical);
  assert.equal(historical.durationMinutes, 75);

  const taskSessions = await repos.sessions.getByTaskId(task.id);
  assert.equal(taskSessions.length, 1);
  assert.equal(taskSessions[0].id, completed.id);
});

test('Session Lifecycle: Discard active session without creating historical session', async () => {
  const { repos } = setupTestEnv();

  const goal = await repos.goals.create(createGoal({ title: 'Game Systems Lab' }));
  const roadmap = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Physics Engine' }));
  const task = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Rigid Body Collision' }));

  await repos.sessions.startActiveSession(task.id);
  assert.ok(await repos.sessions.getActiveSession());

  await repos.sessions.discardActiveSession();
  assert.equal(await repos.sessions.getActiveSession(), null);

  const allSessions = await repos.sessions.getAll();
  assert.equal(allSessions.length, 0);
});

test('Session Integrity: Prevents starting multiple active sessions concurrently (ActiveSessionConflictError)', async () => {
  const { repos } = setupTestEnv();

  const goal = await repos.goals.create(createGoal({ title: 'Academic' }));
  const roadmap = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Algorithms' }));
  const task1 = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Sorting' }));
  const task2 = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Graph Traversal' }));

  await repos.sessions.startActiveSession(task1.id);

  // Attempting to start a second session must throw ActiveSessionConflictError
  await assert.rejects(
    async () => {
      await repos.sessions.startActiveSession(task2.id);
    },
    (err: any) => {
      assert.ok(err instanceof ActiveSessionConflictError);
      assert.equal(err.activeTaskId, task1.id);
      return true;
    }
  );
});

test('Session Integrity: Fails to start session on non-existent task', async () => {
  const { repos } = setupTestEnv();

  await assert.rejects(
    async () => {
      await repos.sessions.startActiveSession('non-existent-task-id');
    },
    (err: unknown) => {
      assert.ok(err instanceof EntityNotFoundError);
      return true;
    }
  );
});

test('Session Integrity: Fails to stop active session when none is running', async () => {
  const { repos } = setupTestEnv();

  await assert.rejects(
    async () => {
      await repos.sessions.stopActiveSession();
    },
    (err: unknown) => {
      assert.ok(err instanceof EntityNotFoundError);
      return true;
    }
  );
});

test('Session Integrity: Handles invalid time ranges safely (e.g. endedAt precedes startedAt)', async () => {
  const { repos } = setupTestEnv();

  const goal = await repos.goals.create(createGoal({ title: 'Academic' }));
  const roadmap = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Logic Circuits' }));
  const task = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Karnaugh Maps' }));

  const startedAt = '2026-09-20T15:00:00.000Z';
  await repos.sessions.startActiveSession(task.id, startedAt);

  // Invalid end before start
  const invalidEndedAt = '2026-09-20T14:30:00.000Z';
  await assert.rejects(
    async () => {
      await repos.sessions.stopActiveSession(invalidEndedAt);
    },
    (err: any) => {
      assert.ok(err instanceof DomainValidationError);
      assert.ok(err.validationErrors.some((e: string) => e.includes('precede startedAt')));
      return true;
    }
  );

  // Active session must remain intact and not corrupted
  const stillActive = await repos.sessions.getActiveSession();
  assert.ok(stillActive);
  assert.equal(stillActive.startedAt, startedAt);
});

test('Manual Sessions: Allows manual creation of completed session without active timer', async () => {
  const { repos } = setupTestEnv();

  const goal = await repos.goals.create(createGoal({ title: 'Academic' }));
  const roadmap = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Data Structures' }));
  const task = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Trees' }));

  const manual = createManualSession({
    taskId: task.id,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T11:30:00.000Z',
  });

  assert.equal(manual.durationMinutes, 90);

  const saved = await repos.sessions.create(manual);
  assert.equal(saved.id, manual.id);
  assert.equal(saved.durationMinutes, 90);

  const fetched = await repos.sessions.getById(manual.id);
  assert.ok(fetched);
  assert.equal(fetched.durationMinutes, 90);
});

test('Persistence: Active session and completed historical sessions survive database close and reopen', async () => {
  const dbName = `test_survive_${Date.now()}`;
  const db1 = new PathFlowDB(dbName);
  const repos1 = createLocalRepositories(db1);

  const goal = await repos1.goals.create(createGoal({ title: 'Systems Research' }));
  const roadmap = await repos1.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Microkernel' }));
  const task1 = await repos1.tasks.create(createTask({ roadmapId: roadmap.id, title: 'IPC Benchmarks' }));
  const task2 = await repos1.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Scheduler' }));

  // Create completed session on task1
  await repos1.sessions.create(
    createSession({
      taskId: task1.id,
      startedAt: '2026-09-20T08:00:00.000Z',
      endedAt: '2026-09-20T09:30:00.000Z',
    })
  );

  // Start active session on task2
  const startedAt = '2026-09-20T10:00:00.000Z';
  await repos1.sessions.startActiveSession(task2.id, startedAt);

  // Close connection
  db1.close();

  // Reopen fresh connection to same database
  const db2 = new PathFlowDB(dbName);
  const repos2 = createLocalRepositories(db2);

  const completedSessions = await repos2.sessions.getAll();
  assert.equal(completedSessions.length, 1);
  assert.equal(completedSessions[0].durationMinutes, 90);

  const active = await repos2.sessions.getActiveSession();
  assert.ok(active);
  assert.equal(active.taskId, task2.id);
  assert.equal(active.startedAt, startedAt);

  // Stop active session on reopened connection
  const completed2 = await repos2.sessions.stopActiveSession('2026-09-20T11:00:00.000Z');
  assert.equal(completed2.durationMinutes, 60);

  assert.equal(await repos2.sessions.getActiveSession(), null);
  assert.equal((await repos2.sessions.getAll()).length, 2);

  db2.close();
});

test('Session Queries: Query sessions by task, by date range, by specific date, and by ISO week', async () => {
  const { repos } = setupTestEnv();

  const goal = await repos.goals.create(createGoal({ title: 'General Learning' }));
  const roadmap = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'CS Core' }));
  const taskA = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Task A' }));
  const taskB = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Task B' }));

  // 2026-09-15 (Tuesday, Week 38)
  await repos.sessions.create(
    createSession({
      taskId: taskA.id,
      startedAt: '2026-09-15T10:00:00.000Z',
      endedAt: '2026-09-15T11:00:00.000Z',
    })
  );

  // 2026-09-20 (Sunday, Week 38)
  await repos.sessions.create(
    createSession({
      taskId: taskA.id,
      startedAt: '2026-09-20T14:00:00.000Z',
      endedAt: '2026-09-20T15:30:00.000Z',
    })
  );

  // 2026-09-21 (Monday, Week 39)
  await repos.sessions.create(
    createSession({
      taskId: taskB.id,
      startedAt: '2026-09-21T09:00:00.000Z',
      endedAt: '2026-09-21T11:00:00.000Z',
    })
  );

  // By Task
  const taskASessions = await repos.sessions.getByTaskId(taskA.id);
  assert.equal(taskASessions.length, 2);

  // By Date (2026-09-20)
  const sep20Sessions = await repos.sessions.getByDate('2026-09-20');
  assert.equal(sep20Sessions.length, 1);
  assert.equal(sep20Sessions[0].durationMinutes, 90);

  // By Date Range (2026-09-15 to 2026-09-20)
  const rangeSessions = await repos.sessions.getByDateRange('2026-09-15', '2026-09-20');
  assert.equal(rangeSessions.length, 2);

  // By ISO Week (2026-W38)
  const week38Sessions = await repos.sessions.getByWeek('2026-W38');
  assert.equal(week38Sessions.length, 2);

  // By ISO Week (2026-W39)
  const week39Sessions = await repos.sessions.getByWeek('2026-W39');
  assert.equal(week39Sessions.length, 1);
  assert.equal(week39Sessions[0].taskId, taskB.id);
});

test('Time Aggregation: Accurately calculates actual minutes across Task, Roadmap, Goal, Weekly Plan, Date, and Week', async () => {
  const { repos } = setupTestEnv();

  const goal = await repos.goals.create(createGoal({ title: 'Game Development' }));
  const roadmap1 = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Systems' }));
  const roadmap2 = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Graphics' }));

  const task1 = await repos.tasks.create(createTask({ roadmapId: roadmap1.id, title: 'Inventory Core', estimatedMinutes: 120 }));
  const task2 = await repos.tasks.create(createTask({ roadmapId: roadmap1.id, title: 'Loot Generation', estimatedMinutes: 60 }));
  const task3 = await repos.tasks.create(createTask({ roadmapId: roadmap2.id, title: 'Shaders', estimatedMinutes: 90 }));

  const plan = await repos.weeklyPlans.create(
    createWeeklyPlan({
      weekIdentifier: '2026-W38',
      title: 'Week 38 Sprint',
      targetMinutes: 300,
      items: [
        createWeeklyPlanItem({ taskId: task1.id, plannedMinutes: 120, targetDate: '2026-09-16' }),
        createWeeklyPlanItem({ taskId: task2.id, plannedMinutes: 60, targetDate: '2026-09-18' }),
      ],
    })
  );

  // Add sessions:
  // Session 1: Task 1, 2026-09-16, 90 mins (Week 38)
  await repos.sessions.create(
    createSession({
      taskId: task1.id,
      startedAt: '2026-09-16T10:00:00.000Z',
      endedAt: '2026-09-16T11:30:00.000Z',
    })
  );
  // Session 2: Task 1, 2026-09-16, 45 mins (Week 38)
  await repos.sessions.create(
    createSession({
      taskId: task1.id,
      startedAt: '2026-09-16T14:00:00.000Z',
      endedAt: '2026-09-16T14:45:00.000Z',
    })
  );
  // Session 3: Task 2, 2026-09-18, 50 mins (Week 38)
  await repos.sessions.create(
    createSession({
      taskId: task2.id,
      startedAt: '2026-09-18T16:00:00.000Z',
      endedAt: '2026-09-18T16:50:00.000Z',
    })
  );
  // Session 4: Task 3, 2026-09-21, 60 mins (Week 39)
  await repos.sessions.create(
    createSession({
      taskId: task3.id,
      startedAt: '2026-09-21T10:00:00.000Z',
      endedAt: '2026-09-21T11:00:00.000Z',
    })
  );

  const allSessions = await repos.sessions.getAll();
  const allTasks = await repos.tasks.getAll();
  const allRoadmaps = await repos.roadmaps.getAll();

  // Task 1: 90 + 45 = 135 mins
  assert.equal(calculateTaskActualMinutes(task1.id, allSessions), 135);
  // Task 2: 50 mins
  assert.equal(calculateTaskActualMinutes(task2.id, allSessions), 50);
  // Task 3: 60 mins
  assert.equal(calculateTaskActualMinutes(task3.id, allSessions), 60);

  // Roadmap 1: 135 + 50 = 185 mins
  assert.equal(calculateRoadmapActualMinutes(roadmap1.id, allTasks, allSessions), 185);
  // Roadmap 2: 60 mins
  assert.equal(calculateRoadmapActualMinutes(roadmap2.id, allTasks, allSessions), 60);

  // Goal: 185 + 60 = 245 mins
  assert.equal(calculateGoalActualMinutes(goal.id, allRoadmaps, allTasks, allSessions), 245);

  // Weekly Plan (Task 1 + Task 2): 135 + 50 = 185 mins
  assert.equal(calculateWeeklyPlanActualMinutes(plan, allSessions), 185);

  // Date 2026-09-16: 90 + 45 = 135 mins
  assert.equal(calculateDateActualMinutes('2026-09-16', allSessions), 135);
  // Date 2026-09-18: 50 mins
  assert.equal(calculateDateActualMinutes('2026-09-18', allSessions), 50);
  // Date with no sessions: 0 mins
  assert.equal(calculateDateActualMinutes('2026-09-19', allSessions), 0);

  // Week 38: 90 + 45 + 50 = 185 mins
  assert.equal(calculateWeekActualMinutes('2026-W38', allSessions), 185);
  // Week 39: 60 mins
  assert.equal(calculateWeekActualMinutes('2026-W39', allSessions), 60);
});

test('Planned vs Actual: Deterministic comparison for Task, Weekly Plan, Roadmap, and Goal', () => {
  const task = createTask({
    id: 'task-inv-1',
    roadmapId: 'road-1',
    title: 'Inventory Grid',
    estimatedMinutes: 120,
  });

  // Scenario 1: Actual 90 mins (under planned by 30 mins)
  const sessionsUnder = [
    createSession({
      taskId: task.id,
      startedAt: '2026-09-20T10:00:00.000Z',
      endedAt: '2026-09-20T11:30:00.000Z',
      durationMinutes: 90,
    }),
  ];
  const comparisonUnder = compareTaskPlannedVsActual(task, sessionsUnder);
  assert.equal(comparisonUnder.plannedMinutes, 120);
  assert.equal(comparisonUnder.actualMinutes, 90);
  assert.equal(comparisonUnder.varianceMinutes, -30);
  assert.equal(comparisonUnder.percentage, 75);

  // Scenario 2: Actual 150 mins (over planned by 30 mins)
  const sessionsOver = [
    ...sessionsUnder,
    createSession({
      taskId: task.id,
      startedAt: '2026-09-20T13:00:00.000Z',
      endedAt: '2026-09-20T14:00:00.000Z',
      durationMinutes: 60,
    }),
  ];
  const comparisonOver = compareTaskPlannedVsActual(task, sessionsOver);
  assert.equal(comparisonOver.plannedMinutes, 120);
  assert.equal(comparisonOver.actualMinutes, 150);
  assert.equal(comparisonOver.varianceMinutes, 30);
  assert.equal(comparisonOver.percentage, 125);

  // Weekly Plan comparison
  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    title: 'Week 38',
    targetMinutes: 600,
    items: [createWeeklyPlanItem({ taskId: task.id, plannedMinutes: 120, targetDate: '2026-09-20' })],
  });
  const planComparison = compareWeeklyPlanPlannedVsActual(plan, sessionsUnder);
  assert.equal(planComparison.plannedMinutes, 600);
  assert.equal(planComparison.actualMinutes, 90);
  assert.equal(planComparison.varianceMinutes, -510);
  assert.equal(planComparison.percentage, 15);
});

test('Historical Activity: Groups sessions into chronological daily activity summaries with task breakdown', () => {
  const sessions = [
    // 2026-09-20: Data Structures (90 min)
    createSession({
      taskId: 'task-trees',
      startedAt: '2026-09-20T10:00:00.000Z',
      endedAt: '2026-09-20T11:30:00.000Z',
    }),
    // 2026-09-20: Logic Circuits (45 min)
    createSession({
      taskId: 'task-kmaps',
      startedAt: '2026-09-20T14:00:00.000Z',
      endedAt: '2026-09-20T14:45:00.000Z',
    }),
    // 2026-09-21: Game Systems Lab Inventory (120 min)
    createSession({
      taskId: 'task-inventory',
      startedAt: '2026-09-21T18:00:00.000Z',
      endedAt: '2026-09-21T20:00:00.000Z',
    }),
  ];

  const summaries = calculateDailyActivitySummaries(sessions);
  assert.equal(summaries.length, 2);

  // 2026-09-20
  assert.equal(summaries[0].date, '2026-09-20');
  assert.equal(summaries[0].totalActualMinutes, 135);
  assert.equal(summaries[0].sessionCount, 2);
  assert.equal(summaries[0].taskActivities.length, 2);

  // 2026-09-21
  assert.equal(summaries[1].date, '2026-09-21');
  assert.equal(summaries[1].totalActualMinutes, 120);
  assert.equal(summaries[1].sessionCount, 1);
  assert.equal(summaries[1].taskActivities[0].taskId, 'task-inventory');
  assert.equal(summaries[1].taskActivities[0].totalActualMinutes, 120);
});

test('Unified Architecture: Academic Learning (Data Structures) and Game Systems Lab (Inventory) use identical time-tracking infrastructure', async () => {
  const { repos } = setupTestEnv();

  // 1. Academic Learning workflow
  const academicGoal = await repos.goals.create(createGoal({ title: 'B.S. Computer Science Core' }));
  const dsRoadmap = await repos.roadmaps.create(createRoadmap({ goalId: academicGoal.id, title: 'Data Structures' }));
  const bstTask = await repos.tasks.create(
    createTask({ roadmapId: dsRoadmap.id, title: 'Red-Black Tree Rotations', estimatedMinutes: 120 })
  );

  // Execute academic study session
  await repos.sessions.startActiveSession(bstTask.id, '2026-09-20T13:00:00.000Z');
  const academicSession = await repos.sessions.stopActiveSession('2026-09-20T14:40:00.000Z'); // 100 min
  assert.equal(academicSession.durationMinutes, 100);

  // 2. Game Systems Lab workflow
  const gameGoal = await repos.goals.create(createGoal({ title: 'Game Systems Lab Portfolio' }));
  const engineRoadmap = await repos.roadmaps.create(createRoadmap({ goalId: gameGoal.id, title: 'Inventory System' }));
  const stackTask = await repos.tasks.create(
    createTask({ roadmapId: engineRoadmap.id, title: 'ItemStack Drag-and-Drop Handler', estimatedMinutes: 90 })
  );

  // Execute game lab development session
  await repos.sessions.startActiveSession(stackTask.id, '2026-09-20T16:00:00.000Z');
  const gameSession = await repos.sessions.stopActiveSession('2026-09-20T17:30:00.000Z'); // 90 min
  assert.equal(gameSession.durationMinutes, 90);

  // Verify both exist seamlessly in shared repositories
  const allSessions = await repos.sessions.getAll();
  assert.equal(allSessions.length, 2);

  // Calculate comparisons using same domain services
  const academicComp = compareTaskPlannedVsActual(bstTask, allSessions);
  assert.equal(academicComp.plannedMinutes, 120);
  assert.equal(academicComp.actualMinutes, 100);
  assert.equal(academicComp.varianceMinutes, -20);

  const gameComp = compareTaskPlannedVsActual(stackTask, allSessions);
  assert.equal(gameComp.plannedMinutes, 90);
  assert.equal(gameComp.actualMinutes, 90);
  assert.equal(gameComp.varianceMinutes, 0);
  assert.equal(gameComp.percentage, 100);

  // Aggregate by day (both on 2026-09-20)
  const dayMinutes = calculateDateActualMinutes('2026-09-20', allSessions);
  assert.equal(dayMinutes, 190); // 100 + 90
});
