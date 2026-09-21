import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateEntityId,
  createTimestamp,
} from '../../src/domain';
import {
  PathFlowDB,
  createLocalRepositories,
} from '../../src/data';
import {
  createApplicationServices,
  ApplicationServices,
  ValidationError,
  NotFoundError,
  DependencyConstraintError,
  ActiveSessionConflictError,
  InvalidStateTransitionError,
} from '../../src/application';

function setupServices(): { services: ApplicationServices; db: PathFlowDB } {
  const dbName = `test-app-${generateEntityId()}`;
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
  return { services, db };
}

test('Goal Application Service: creation, retrieval, validation, update, and deletion constraints', async () => {
  const { services } = setupServices();

  // 1. Create valid goal
  const goal = await services.goals.createGoal({
    title: 'Become Senior Systems Engineer',
    description: 'Master Rust and Distributed Systems',
  });
  assert.ok(goal.id);
  assert.equal(goal.title, 'Become Senior Systems Engineer');
  assert.equal(goal.status, 'not_started');

  // 2. Reject empty title
  await assert.rejects(
    async () => {
      await services.goals.createGoal({ title: '   ' });
    },
    (err: unknown) => err instanceof ValidationError
  );

  // 3. Retrieve Goal
  const fetched = await services.goals.getGoal(goal.id);
  assert.equal(fetched.id, goal.id);

  // 4. Update Goal
  const updated = await services.goals.updateGoal(goal.id, {
    title: 'Staff Systems Engineer',
  });
  assert.equal(updated.title, 'Staff Systems Engineer');

  // 5. Delete constraint: cannot delete if roadmaps exist
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Rust Concurrency',
  });
  assert.ok(roadmap.id);

  await assert.rejects(
    async () => {
      await services.goals.deleteGoal(goal.id);
    },
    (err: unknown) => err instanceof DependencyConstraintError
  );

  // Delete roadmap first, then delete goal succeeds
  await services.roadmaps.deleteRoadmap(roadmap.id);
  await services.goals.deleteGoal(goal.id);

  await assert.rejects(
    async () => {
      await services.goals.getGoal(goal.id);
    },
    (err: unknown) => err instanceof NotFoundError
  );
});

test('Roadmap Application Service: parent Goal validation, task constraints, and deletion', async () => {
  const { services } = setupServices();

  // 1. Rejects roadmap creation if parent Goal does not exist
  await assert.rejects(
    async () => {
      await services.roadmaps.createRoadmap({
        goalId: generateEntityId(),
        title: 'Orphan Roadmap',
      });
    },
    (err: unknown) => err instanceof NotFoundError
  );

  // 2. Create parent goal and roadmap
  const goal = await services.goals.createGoal({ title: 'Computer Science Core' });
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Operating Systems',
  });
  assert.equal(roadmap.goalId, goal.id);

  // 3. Create dependent Task
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Implement Virtual Memory Pager',
    estimatedMinutes: 180,
  });
  assert.equal(task.roadmapId, roadmap.id);

  // 4. Cannot delete roadmap while tasks exist
  await assert.rejects(
    async () => {
      await services.roadmaps.deleteRoadmap(roadmap.id);
    },
    (err: unknown) => err instanceof DependencyConstraintError
  );

  // Delete task first, then roadmap deletion succeeds
  await services.tasks.deleteTask(task.id);
  await services.roadmaps.deleteRoadmap(roadmap.id);
});

test('Task Application Service: creation, lifecycle transitions, and relational integrity', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Algorithms' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Trees & Graphs' });

  // 1. Create task
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Red-Black Tree Deletion',
    estimatedMinutes: 120,
  });
  assert.equal(task.status, 'todo');

  // 2. Valid status transition: todo -> in_progress
  const inProgressTask = await services.tasks.transitionTaskStatus(task.id, 'in_progress');
  assert.equal(inProgressTask.status, 'in_progress');

  // 3. Valid status transition: in_progress -> blocked
  const blockedTask = await services.tasks.transitionTaskStatus(task.id, 'blocked');
  assert.equal(blockedTask.status, 'blocked');

  // 4. Invalid status transition: blocked -> completed (cannot go directly to completed without in_progress or todo)
  await assert.rejects(
    async () => {
      await services.tasks.transitionTaskStatus(task.id, 'completed');
    },
    (err: unknown) => err instanceof InvalidStateTransitionError
  );

  // 5. Complete task: blocked -> in_progress -> completed
  await services.tasks.transitionTaskStatus(task.id, 'in_progress');
  const completedTask = await services.tasks.transitionTaskStatus(task.id, 'completed');
  assert.equal(completedTask.status, 'completed');
  assert.ok(completedTask.completedAt);
});

test('Session Application Service: active timer singleton constraint and manual logging', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Game Development' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Physics Engine' });
  const task1 = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Spatial Hashing' });
  const task2 = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Rigid Body Collision' });

  // 1. Start active session for task1
  const startTs = createTimestamp();
  const active1 = await services.sessions.startSession(task1.id, startTs);
  assert.equal(active1.taskId, task1.id);

  // 2. Active session conflict: cannot start session for task2 concurrently
  await assert.rejects(
    async () => {
      await services.sessions.startSession(task2.id);
    },
    (err: unknown) => err instanceof ActiveSessionConflictError
  );

  // 3. Complete active session
  const endTs = new Date(Date.now() + 45 * 60 * 1000).toISOString();
  const completedSession = await services.sessions.completeSession(endTs);
  assert.equal(completedSession.taskId, task1.id);
  assert.equal(completedSession.durationMinutes, 45);

  // Active session is now null
  const activeAfterComplete = await services.sessions.getActiveSession();
  assert.equal(activeAfterComplete, null);

  // 4. Manual session creation
  const manual = await services.sessions.createManualSession({
    taskId: task2.id,
    startedAt: '2026-09-18T10:00:00.000Z',
    endedAt: '2026-09-18T11:30:00.000Z',
    notes: 'Researched swept sphere bounding boxes',
  });
  assert.equal(manual.durationMinutes, 90);
  assert.equal(manual.taskId, task2.id);

  // 5. Query sessions for date & week
  const dateSessions = await services.sessions.listSessionsForDate('2026-09-18');
  assert.equal(dateSessions.length, 1);
  assert.equal(dateSessions[0].id, manual.id);

  const weekSessions = await services.sessions.listSessionsForWeek('2026-W38');
  assert.equal(weekSessions.length, 1);
});

test('Weekly Planning Application Service: plan creation, daily item allocation, and duplicate prevention', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Math for CS' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Linear Algebra' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Eigenvalues & SVD' });

  // 1. Create Weekly Plan for 2026-W38 (September 14-20, 2026)
  const plan = await services.weeklyPlans.createWeeklyPlan({
    weekIdentifier: '2026-W38',
    title: 'Sprint 38: Linear Transformations',
    targetMinutes: 600,
  });
  assert.equal(plan.weekIdentifier, '2026-W38');
  assert.equal(plan.items.length, 0);

  // 2. Reject duplicate plan for the same week
  await assert.rejects(
    async () => {
      await services.weeklyPlans.createWeeklyPlan({
        weekIdentifier: '2026-W38',
      });
    },
    (err: unknown) => err instanceof ValidationError
  );

  // 3. Add daily allocation item (2026-09-15 is Tuesday of W38)
  const updatedPlan = await services.weeklyPlans.addWeeklyPlanItem(plan.id, {
    taskId: task.id,
    targetDate: '2026-09-15',
    plannedMinutes: 120,
  });
  assert.equal(updatedPlan.items.length, 1);
  assert.equal(updatedPlan.items[0].plannedMinutes, 120);

  // 4. Reject allocation for a date OUTSIDE W38 (e.g. 2026-09-22 is in W39)
  await assert.rejects(
    async () => {
      await services.weeklyPlans.addWeeklyPlanItem(plan.id, {
        taskId: task.id,
        targetDate: '2026-09-22',
        plannedMinutes: 60,
      });
    },
    (err: unknown) => err instanceof ValidationError
  );

  // 5. Reject duplicate allocation for the same task on the same date
  await assert.rejects(
    async () => {
      await services.weeklyPlans.addWeeklyPlanItem(plan.id, {
        taskId: task.id,
        targetDate: '2026-09-15',
        plannedMinutes: 60,
      });
    },
    (err: unknown) => err instanceof ValidationError
  );

  // 6. Update plan item
  const itemId = updatedPlan.items[0].id;
  const modifiedPlan = await services.weeklyPlans.updateWeeklyPlanItem(plan.id, itemId, {
    plannedMinutes: 150,
    isCompleted: true,
  });
  assert.equal(modifiedPlan.items[0].plannedMinutes, 150);
  assert.equal(modifiedPlan.items[0].isCompleted, true);
});

test('Progress & Review Application Service: daily and weekly summary calculations', async () => {
  const { services } = setupServices();

  // Create full hierarchy
  const goal = await services.goals.createGoal({ title: 'Fullstack Mastery' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Database Optimization' });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'B-Tree Indexing Strategies',
    estimatedMinutes: 180,
  });

  // Create plan for 2026-W38
  const plan = await services.weeklyPlans.createWeeklyPlan({
    weekIdentifier: '2026-W38',
    targetMinutes: 300,
  });

  await services.weeklyPlans.addWeeklyPlanItem(plan.id, {
    taskId: task.id,
    targetDate: '2026-09-16',
    plannedMinutes: 120,
  });

  // Log session for 2026-09-16
  await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-16T14:00:00.000Z',
    endedAt: '2026-09-16T16:00:00.000Z', // 120 minutes
  });

  // 1. Daily Progress for 2026-09-16
  const daily = await services.progress.getDailyProgress('2026-09-16');
  assert.equal(daily.date, '2026-09-16');
  assert.equal(daily.totalActualMinutes, 120);
  assert.equal(daily.plannedMinutes, 120);
  assert.equal(daily.plannedVsActual.varianceMinutes, 0);

  // 2. Weekly Review for 2026-W38
  const weekly = await services.progress.getWeeklyProgress('2026-W38');
  assert.equal(weekly.weekIdentifier, '2026-W38');
  assert.equal(weekly.actualMinutes, 120);
  assert.equal(weekly.plannedMinutes, 120);

  // 3. Roadmap Progress
  const roadmapProg = await services.progress.getRoadmapProgress(roadmap.id);
  assert.equal(roadmapProg.roadmapId, roadmap.id);
  assert.equal(roadmapProg.totalActualMinutes, 120);

  // 4. Goal Progress
  const goalProg = await services.progress.getGoalProgress(goal.id);
  assert.equal(goalProg.goalId, goal.id);
  assert.equal(goalProg.totalActualMinutes, 120);
});
