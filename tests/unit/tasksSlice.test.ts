import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

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
  ValidationError,
  NotFoundError,
  DependencyConstraintError,
  InvalidStateTransitionError,
} from '../../src/application';
import { parseHashToState } from '../../src/app/providers/RouterProvider';

function setupServices(): { services: ApplicationServices; db: PathFlowDB } {
  const dbName = `test-tasks-slice-${generateEntityId()}`;
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

test('Vertical Slice: Task creation inside roadmap with defaults and fast input', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Full Stack Mastery' });
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Milestone 1: Backend Foundation',
  });

  // Fast minimal creation
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Setup Database Engine',
  });

  assert.ok(task.id, 'Task must receive an ID');
  assert.equal(task.roadmapId, roadmap.id);
  assert.equal(task.title, 'Setup Database Engine');
  assert.equal(task.description, '');
  assert.equal(task.status, 'todo', 'Default status must be todo');
  assert.equal(task.priority, 'medium', 'Default priority must be medium');
  assert.equal(task.estimatedMinutes, 0, 'Default estimated minutes must be 0');
  assert.equal(task.completedAt, undefined);

  // Listing tasks for roadmap
  const roadmapTasks = await services.tasks.listTasksForRoadmap(roadmap.id);
  assert.equal(roadmapTasks.length, 1);
  assert.equal(roadmapTasks[0].id, task.id);
});

test('Vertical Slice: Task creation with full optional parameters', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Frontend Mastery' });
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Milestone 1: UI Engine',
  });

  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Build Design System Components',
    description: 'Implement typography, button, and card primitives with Tailwind',
    priority: 'urgent',
    estimatedMinutes: 90,
  });

  assert.equal(task.title, 'Build Design System Components');
  assert.equal(task.description, 'Implement typography, button, and card primitives with Tailwind');
  assert.equal(task.priority, 'urgent');
  assert.equal(task.estimatedMinutes, 90);
});

test('Vertical Slice: Task creation validation constraints', async () => {
  const { services } = setupServices();

  // Non-existent roadmap
  await assert.rejects(
    async () => {
      await services.tasks.createTask({
        roadmapId: 'non-existent-roadmap',
        title: 'Valid Title',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError);
      return true;
    }
  );

  const goal = await services.goals.createGoal({ title: 'Goal for Validation' });
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Roadmap for Validation',
  });

  // Empty title
  await assert.rejects(
    async () => {
      await services.tasks.createTask({
        roadmapId: roadmap.id,
        title: '   ',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      return true;
    }
  );
});

test('Vertical Slice: Task status lifecycle transitions and completedAt timestamp management', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Lifecycle Goal' });
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Lifecycle Roadmap',
  });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'State Transition Unit',
  });

  assert.equal(task.status, 'todo');
  assert.equal(task.completedAt, undefined);

  // todo -> in_progress
  const inProgress = await services.tasks.transitionTaskStatus(task.id, 'in_progress');
  assert.equal(inProgress.status, 'in_progress');
  assert.equal(inProgress.completedAt, undefined);

  // in_progress -> completed
  const completed = await services.tasks.transitionTaskStatus(task.id, 'completed');
  assert.equal(completed.status, 'completed');
  assert.ok(completed.completedAt, 'completedAt timestamp must be assigned upon completion');

  // completed -> todo (reopen)
  const reopened = await services.tasks.transitionTaskStatus(task.id, 'todo');
  assert.equal(reopened.status, 'todo');
  assert.equal(reopened.completedAt, undefined, 'completedAt must be cleared when reopening');

  // Invalid transition from cancelled to in_progress (business rule: cancelled can only go to todo)
  const cancelled = await services.tasks.transitionTaskStatus(task.id, 'cancelled');
  assert.equal(cancelled.status, 'cancelled');

  await assert.rejects(
    async () => {
      await services.tasks.transitionTaskStatus(task.id, 'in_progress');
    },
    (err: unknown) => {
      assert.ok(err instanceof InvalidStateTransitionError);
      return true;
    }
  );
});

test('Vertical Slice: Task update respects attributes without resetting status or parent', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Update Goal' });
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Update Roadmap',
  });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Original Title',
    estimatedMinutes: 30,
    priority: 'low',
  });

  await services.tasks.transitionTaskStatus(task.id, 'in_progress');

  const updated = await services.tasks.updateTask(task.id, {
    title: 'Updated Title',
    description: 'Updated Description',
    priority: 'high',
    estimatedMinutes: 45,
  });

  assert.equal(updated.title, 'Updated Title');
  assert.equal(updated.description, 'Updated Description');
  assert.equal(updated.priority, 'high');
  assert.equal(updated.estimatedMinutes, 45);
  assert.equal(updated.status, 'in_progress', 'Status must not be reset by updateTask');
  assert.equal(updated.roadmapId, roadmap.id, 'Roadmap ID must be preserved');
});

test('Vertical Slice: Task deletion and session dependency constraint enforcement', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Deletion Goal' });
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Deletion Roadmap',
  });
  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Deletable Task',
  });

  // Successful deletion when no sessions attached
  await services.tasks.deleteTask(task.id);
  const remaining = await services.tasks.listTasksForRoadmap(roadmap.id);
  assert.equal(remaining.length, 0);

  // Attempting to delete when session attached must be blocked
  const taskWithSession = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Task With History',
  });

  const now = new Date();
  const startedAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const endedAt = now.toISOString();

  await services.sessions.createManualSession({
    taskId: taskWithSession.id,
    startedAt,
    endedAt,
  });

  await assert.rejects(
    async () => {
      await services.tasks.deleteTask(taskWithSession.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof DependencyConstraintError);
      return true;
    }
  );
});

test('Vertical Slice: Roadmap progress calculation with real tasks', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Progress Goal' });
  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Progress Roadmap',
  });

  // Zero tasks -> 0 progress
  let progress = await services.progress.getRoadmapProgress(roadmap.id);
  assert.equal(progress.totalTasks, 0);
  assert.equal(progress.completedTasks, 0);
  assert.equal(progress.taskCompletionPercentage, 0);

  // Create 4 tasks: 2 completed, 1 in_progress, 1 todo
  const t1 = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Task 1', estimatedMinutes: 60 });
  const t2 = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Task 2', estimatedMinutes: 30 });
  const t3 = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Task 3', estimatedMinutes: 45 });
  const t4 = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Task 4', estimatedMinutes: 15 });

  await services.tasks.transitionTaskStatus(t1.id, 'completed');
  await services.tasks.transitionTaskStatus(t2.id, 'completed');
  await services.tasks.transitionTaskStatus(t3.id, 'in_progress');

  progress = await services.progress.getRoadmapProgress(roadmap.id);
  assert.equal(progress.totalTasks, 4);
  assert.equal(progress.completedTasks, 2);
  assert.equal(progress.taskCompletionPercentage, 50); // 2 out of 4 = 50%
  assert.equal(progress.totalEstimatedMinutes, 150); // 60 + 30 + 45 + 15 = 150
});

test('Vertical Slice: Task client-side route parsing', () => {
  // Global tasks list
  const state1 = parseHashToState('#/tasks');
  assert.equal(state1.route, 'tasks');
  assert.deepEqual(state1.params, {});

  // Task detail view via URL path segment
  const state2 = parseHashToState('#tasks/task_12345');
  assert.equal(state2.route, 'tasks');
  assert.equal(state2.params.id, 'task_12345');
});
