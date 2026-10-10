import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  generateEntityId,
} from '../../src/domain';
import {
  PathFlowDB,
  createLocalRepositories,
} from '../../src/data';
import {
  createApplicationServices,
  ApplicationServices,
  GoalService,
  ValidationError,
  NotFoundError,
  DependencyConstraintError,
  ApplicationPersistenceError,
} from '../../src/application';
import { createDurableSyncOutbox, createSyncRecordingRepositories } from '../../src/sync';
import { parseHashToState } from '../../src/app/providers/RouterProvider';

function setupServices(): { services: ApplicationServices; db: PathFlowDB } {
  const dbName = `test-goals-roadmaps-${generateEntityId()}`;
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

test('Vertical Slice: Goal creation with minimal friction and default status', async () => {
  const { services } = setupServices();

  // Create minimal goal
  const goal = await services.goals.createGoal({
    title: 'Master Modern Web Architectures',
  });

  assert.ok(goal.id, 'Goal should receive a generated ID');
  assert.equal(goal.title, 'Master Modern Web Architectures');
  assert.equal(goal.description, '');
  assert.equal(goal.status, 'not_started', 'Default status must remain not_started');
  assert.ok(goal.createdAt);
  assert.ok(goal.updatedAt);
  assert.equal(goal.createdAt, goal.updatedAt);

  // List goals reflects new goal
  const list = await services.goals.listGoals();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, goal.id);
});

test('Vertical Slice: Goal editing updates attributes while preserving ID and createdAt', async () => {
  const { services } = setupServices();

  const original = await services.goals.createGoal({
    title: 'Initial Goal Title',
    description: 'Initial description',
  });

  // Small delay to ensure timestamp progression
  await new Promise((resolve) => setTimeout(resolve, 5));

  const updated = await services.goals.updateGoal(original.id, {
    title: 'Updated Goal Title',
    description: 'Updated comprehensive description',
    status: 'in_progress',
  });

  assert.equal(updated.id, original.id, 'Goal ID must be preserved');
  assert.equal(updated.createdAt, original.createdAt, 'createdAt must be preserved');
  assert.equal(updated.title, 'Updated Goal Title');
  assert.equal(updated.description, 'Updated comprehensive description');
  assert.equal(updated.status, 'in_progress');
  assert.ok(updated.updatedAt >= original.updatedAt, 'updatedAt must be updated');
});

test('Vertical Slice: Goal status transitions and archiving', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({
    title: 'Goal To Archive',
  });
  assert.equal(goal.status, 'not_started');

  // Change status to in_progress
  const inProg = await services.goals.updateGoal(goal.id, { status: 'in_progress' });
  assert.equal(inProg.status, 'in_progress');

  // Change status to completed
  const completed = await services.goals.updateGoal(goal.id, { status: 'completed' });
  assert.equal(completed.status, 'completed');

  // Archive goal via archiveGoal
  const archived = await services.goals.archiveGoal(goal.id);
  assert.equal(archived.status, 'archived');

  // Verify retrieval
  const fetched = await services.goals.getGoal(goal.id);
  assert.equal(fetched.status, 'archived');
});

test('Vertical Slice: Roadmap management under a Goal', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({
    title: 'Full Stack Engineering Specialization',
  });

  // Create Roadmap 1
  const roadmap1 = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Frontend Architecture & React Patterns',
    description: 'State management, custom hooks, and offline synchronization',
  });
  assert.ok(roadmap1.id);
  assert.equal(roadmap1.goalId, goal.id);
  assert.equal(roadmap1.title, 'Frontend Architecture & React Patterns');

  // Create Roadmap 2
  const roadmap2 = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Database Design & Indexing',
  });
  assert.ok(roadmap2.id);

  // Retrieve roadmaps for goal
  const goalRoadmaps = await services.roadmaps.listRoadmapsForGoal(goal.id);
  assert.equal(goalRoadmaps.length, 2);
  const titles = goalRoadmaps.map((r) => r.title);
  assert.ok(titles.includes('Frontend Architecture & React Patterns'));
  assert.ok(titles.includes('Database Design & Indexing'));

  // Edit Roadmap
  const editedR1 = await services.roadmaps.updateRoadmap(roadmap1.id, {
    title: 'Advanced Frontend Architecture',
    description: 'Deep dive into rendering pipelines',
  });
  assert.equal(editedR1.id, roadmap1.id);
  assert.equal(editedR1.goalId, goal.id);
  assert.equal(editedR1.title, 'Advanced Frontend Architecture');
  assert.equal(editedR1.description, 'Deep dive into rendering pipelines');
  assert.equal(editedR1.createdAt, roadmap1.createdAt);
});

test('Vertical Slice: Deletion dependency rules for Goal and Roadmap', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Autonomous Systems' });
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'SLAM and State Estimation',
  });

  // Goal cannot be deleted while roadmap exists
  await assert.rejects(
    async () => {
      await services.goals.deleteGoal(goal.id);
    },
    (err: unknown) => err instanceof DependencyConstraintError
  );

  // Add dependent task to roadmap
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Implement Kalman Filter',
    estimatedMinutes: 120,
  });

  // Roadmap cannot be deleted while tasks exist
  await assert.rejects(
    async () => {
      await services.roadmaps.deleteRoadmap(roadmap.id);
    },
    (err: unknown) => err instanceof DependencyConstraintError
  );

  // Delete task -> delete roadmap succeeds
  await services.tasks.deleteTask(task.id);
  await services.roadmaps.deleteRoadmap(roadmap.id);

  // Roadmap is deleted
  await assert.rejects(
    async () => {
      await services.roadmaps.getRoadmap(roadmap.id);
    },
    (err: unknown) => err instanceof NotFoundError
  );

  // Now Goal can be deleted
  await services.goals.deleteGoal(goal.id);
  await assert.rejects(
    async () => {
      await services.goals.getGoal(goal.id);
    },
    (err: unknown) => err instanceof NotFoundError
  );
});

test('Vertical Slice: Derived progress calculation for Goal and Roadmap', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Systems Research' });
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Raft Paper Implementation',
  });

  // Initial derived progress with no tasks
  const initialGoalProg = await services.progress.getGoalProgress(goal.id);
  assert.equal(initialGoalProg.totalRoadmaps, 1);
  assert.equal(initialGoalProg.totalTasks, 0);
  assert.equal(initialGoalProg.taskCompletionPercentage, 0);
  assert.equal(initialGoalProg.totalActualMinutes, 0);

  const initialRoadmapProg = await services.progress.getRoadmapProgress(roadmap.id);
  assert.equal(initialRoadmapProg.totalTasks, 0);
  assert.equal(initialRoadmapProg.taskCompletionPercentage, 0);

  // Add tasks and sessions to verify real aggregation through application services
  const task1 = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Leader Election Protocol',
    estimatedMinutes: 60,
  });
  const task2 = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Log Replication Protocol',
    estimatedMinutes: 60,
  });

  // Transition task1 to completed
  await services.tasks.updateTaskStatus(task1.id, 'in_progress');
  await services.tasks.updateTaskStatus(task1.id, 'completed');

  // Record completed session for task1 (45 min)
  await services.sessions.createManualSession({
    taskId: task1.id,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T10:45:00.000Z',
    notes: 'Completed leader election logic',
  });

  // Derived Roadmap Progress
  const updatedRoadmapProg = await services.progress.getRoadmapProgress(roadmap.id);
  assert.equal(updatedRoadmapProg.totalTasks, 2);
  assert.equal(updatedRoadmapProg.completedTasks, 1);
  assert.equal(updatedRoadmapProg.taskCompletionPercentage, 50);
  assert.equal(updatedRoadmapProg.totalActualMinutes, 45);

  // Derived Goal Progress
  const updatedGoalProg = await services.progress.getGoalProgress(goal.id);
  assert.equal(updatedGoalProg.totalTasks, 2);
  assert.equal(updatedGoalProg.completedTasks, 1);
  assert.equal(updatedGoalProg.taskCompletionPercentage, 50);
  assert.equal(updatedGoalProg.totalActualMinutes, 45);
});

test('Vertical Slice: Zero-dependency router path and param parsing', () => {
  // Base routes
  assert.deepEqual(parseHashToState('#goals'), {
    route: 'goals',
    params: {},
    hashString: 'goals',
  });

  assert.deepEqual(parseHashToState('#/goals'), {
    route: 'goals',
    params: {},
    hashString: 'goals',
  });

  // Param routes
  assert.deepEqual(parseHashToState('#goals/goal-123-abc'), {
    route: 'goals',
    params: { id: 'goal-123-abc' },
    hashString: 'goals/goal-123-abc',
  });

  assert.deepEqual(parseHashToState('#roadmaps/rm-999-xyz'), {
    route: 'roadmaps',
    params: { id: 'rm-999-xyz' },
    hashString: 'roadmaps/rm-999-xyz',
  });

  // Fallback route
  assert.deepEqual(parseHashToState('#unknown-path'), {
    route: 'dashboard',
    params: {},
    hashString: 'dashboard',
  });
});

test('Regression: Goal deletion flow persists to IndexedDB, records outbox mutation, preserves related records, and surfaces errors', async () => {
  const dbName = `test-goal-delete-reg-${generateEntityId()}`;
  const db = new PathFlowDB(dbName);
  const rawRepos = createLocalRepositories(db);
  const outbox = createDurableSyncOutbox(`test-outbox-${generateEntityId()}`);
  const syncRepos = createSyncRecordingRepositories({
    repositories: rawRepos,
    outbox,
    getDeviceId: () => 'device-test-1',
  });
  const services = createApplicationServices(syncRepos);

  // 1. Create two goals
  const goalWithDeps = await services.goals.createGoal({
    title: 'Goal With Attached Roadmap',
    description: 'Should be protected from accidental deletion',
  });
  const standaloneGoal = await services.goals.createGoal({
    title: 'Standalone Goal To Delete',
    description: 'Can be deleted directly',
  });

  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goalWithDeps.id,
    title: 'Dependent Roadmap',
  });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Dependent Task',
    estimatedMinutes: 60,
  });

  // 2. Deleting standaloneGoal succeeds, removes it from IndexedDB, and records delete mutation in outbox
  await services.goals.deleteGoal(standaloneGoal.id);

  const remainingGoals = await services.goals.listGoals();
  assert.equal(remainingGoals.length, 1);
  assert.equal(remainingGoals[0].id, goalWithDeps.id);

  const rawDeletedLookup = await db.goals.get(standaloneGoal.id);
  assert.equal(rawDeletedLookup, undefined, 'Deleted goal must be removed from IndexedDB storage');

  const outboxItems = await outbox.getAll();
  const deleteMutation = outboxItems.find(
    (item) => item.mutation.entityType === 'goal' && item.mutation.operation === 'delete' && item.mutation.entityId === standaloneGoal.id
  );
  assert.ok(deleteMutation, 'Goal deletion must be recorded in sync outbox');

  // 3. Attempting to delete goalWithDeps throws DependencyConstraintError and does NOT cascade-delete roadmap or task
  await assert.rejects(
    async () => {
      await services.goals.deleteGoal(goalWithDeps.id);
    },
    (err: unknown) => err instanceof DependencyConstraintError
  );

  const preservedGoal = await db.goals.get(goalWithDeps.id);
  assert.ok(preservedGoal, 'Goal with roadmap must remain in IndexedDB');
  const preservedRoadmap = await db.roadmaps.get(roadmap.id);
  assert.ok(preservedRoadmap, 'Dependent roadmap must not be cascade-deleted');
  const preservedTask = await db.tasks.get(task.id);
  assert.ok(preservedTask, 'Dependent task must not be cascade-deleted');

  // 4. Repository failure during deletion is surfaced as ApplicationPersistenceError (never swallowed)
  const failingGoalService = new GoalService(
    {
      create: (g) => rawRepos.goals.create(g),
      getById: (id) => rawRepos.goals.getById(id),
      getAll: () => rawRepos.goals.getAll(),
      update: (g) => rawRepos.goals.update(g),
      delete: async () => {
        throw new Error('Simulated IndexedDB delete failure');
      },
    },
    rawRepos.roadmaps
  );

  const deletableGoal = await services.goals.createGoal({ title: 'Goal For Failure Test' });
  await assert.rejects(
    async () => {
      await failingGoalService.deleteGoal(deletableGoal.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof ApplicationPersistenceError);
      assert.match((err as Error).message, /Simulated IndexedDB delete failure/);
      return true;
    }
  );

  // 5. Verify UI components wire deleteGoal and confirmation modals in GoalListView and GoalDetailView
  const goalListViewSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/goals/GoalListView.tsx'),
    'utf-8'
  );
  assert.ok(
    goalListViewSource.includes('application.goals.deleteGoal(goalToDelete.id)'),
    'GoalListView must invoke application.goals.deleteGoal'
  );
  assert.ok(
    goalListViewSource.includes('btn-delete-goal-${goal.id}') &&
      goalListViewSource.includes('btn-confirm-delete-goal'),
    'GoalListView must render delete button and confirmation modal controls'
  );

  const goalDetailViewSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/goals/GoalDetailView.tsx'),
    'utf-8'
  );
  assert.ok(
    goalDetailViewSource.includes('application.goals.deleteGoal(goal.id)'),
    'GoalDetailView must invoke application.goals.deleteGoal'
  );
  assert.ok(
    goalDetailViewSource.includes('id="btn-delete-goal"') &&
      goalDetailViewSource.includes('id="btn-confirm-detail-delete-goal"'),
    'GoalDetailView must render delete goal button and confirmation modal controls'
  );
  assert.ok(
    !goalDetailViewSource.includes('window.confirm'),
    'GoalDetailView must use in-app confirmation modal instead of window.confirm'
  );

  await db.close();
});

