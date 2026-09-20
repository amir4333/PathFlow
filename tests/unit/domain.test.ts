import test from 'node:test';
import assert from 'node:assert/strict';

import {
  // Primitives
  generateEntityId,
  isValidEntityId,
  createTimestamp,
  isValidTimestamp,
  calculateDurationMinutes,

  // Models & Factories
  createGoal,
  createRoadmap,
  createTask,
  createSession,
  createWeeklyPlan,
  createWeeklyPlanItem,

  // Rules & Transitions
  validateGoal,
  validateRoadmap,
  validateTask,
  validateSession,
  validateWeeklyPlan,
  validateWeeklyPlanItem,
  canTransitionTaskStatus,
  transitionTaskStatus,

  // Services
  calculateTaskProgress,
  calculateSessionProgress,
  calculateWeeklyPlanProgress,
  calculateRoadmapProgress,
  calculateGoalProgress,
} from '../../src/domain/index';

test('Domain Primitives: Identifier generation and validation', () => {
  const id1 = generateEntityId();
  const id2 = generateEntityId();

  assert.ok(isValidEntityId(id1), 'Generated ID should be valid');
  assert.ok(isValidEntityId(id2), 'Generated ID should be valid');
  assert.notEqual(id1, id2, 'Generated IDs must be unique');

  assert.equal(isValidEntityId(''), false, 'Empty string is not a valid ID');
  assert.equal(isValidEntityId('   '), false, 'Whitespace is not a valid ID');
  assert.equal(isValidEntityId(null), false, 'Null is not a valid ID');
  assert.equal(isValidEntityId(undefined), false, 'Undefined is not a valid ID');
});

test('Domain Primitives: Timestamp generation, validation, and duration calculation', () => {
  const nowStr = createTimestamp();
  assert.ok(isValidTimestamp(nowStr), 'createTimestamp produces a valid ISO string');
  assert.ok(nowStr.endsWith('Z'), 'Timestamp should be in UTC (ends with Z)');

  assert.equal(isValidTimestamp('not-a-date'), false);
  assert.equal(isValidTimestamp(''), false);

  const t1 = '2026-09-20T10:00:00.000Z';
  const t2 = '2026-09-20T10:45:00.000Z';
  const duration = calculateDurationMinutes(t1, t2);
  assert.equal(duration, 45, 'calculateDurationMinutes should calculate elapsed whole minutes');

  const zeroDuration = calculateDurationMinutes(t1, t1);
  assert.equal(zeroDuration, 0, 'Identical timestamps yield 0 minutes');
});

test('Goal: Creation and validation rules', () => {
  const goal = createGoal({
    title: 'Master Distributed Systems',
    description: 'Deep dive into consensus protocols and CRDTs',
  });

  assert.ok(isValidEntityId(goal.id));
  assert.equal(goal.title, 'Master Distributed Systems');
  assert.equal(goal.status, 'not_started');
  assert.ok(isValidTimestamp(goal.createdAt));
  assert.ok(isValidTimestamp(goal.updatedAt));

  const validation = validateGoal(goal);
  assert.equal(validation.isValid, true);
  assert.equal(validation.errors.length, 0);

  // Invalid goal with empty title
  const invalidGoal = createGoal({ title: '   ' });
  const invalidValidation = validateGoal(invalidGoal);
  assert.equal(invalidValidation.isValid, false);
  assert.ok(invalidValidation.errors.some((e) => e.includes('title')));
});

test('Roadmap: Relationship to Goal and validation rules', () => {
  const goal = createGoal({ title: 'Build Offline-First App' });
  const roadmap = createRoadmap({
    goalId: goal.id,
    title: 'Phase 1: Architecture & Domain Foundation',
    description: 'Establish layered architecture and pure domain types',
  });

  assert.ok(isValidEntityId(roadmap.id));
  assert.equal(roadmap.goalId, goal.id, 'Roadmap must reference Goal by ID');
  assert.equal(roadmap.title, 'Phase 1: Architecture & Domain Foundation');

  const validResult = validateRoadmap(roadmap);
  assert.equal(validResult.isValid, true);

  // Invalid: missing goalId reference
  const invalidRoadmap = {
    ...roadmap,
    goalId: '',
  };
  const invalidResult = validateRoadmap(invalidRoadmap);
  assert.equal(invalidResult.isValid, false);
  assert.ok(invalidResult.errors.some((e) => e.includes('goalId')));
});

test('Task: Creation, defaults, priority, and validation', () => {
  const roadmap = createRoadmap({
    goalId: generateEntityId(),
    title: 'Roadmap Milestone',
  });

  const task = createTask({
    roadmapId: roadmap.id,
    title: 'Implement Domain Entities',
    priority: 'high',
    estimatedMinutes: 90,
  });

  assert.equal(task.roadmapId, roadmap.id);
  assert.equal(task.title, 'Implement Domain Entities');
  assert.equal(task.status, 'todo');
  assert.equal(task.priority, 'high');
  assert.equal(task.estimatedMinutes, 90);
  assert.equal(task.completedAt, undefined);

  const validation = validateTask(task);
  assert.equal(validation.isValid, true);

  // Negative estimatedMinutes validation
  const negativeTask = {
    ...task,
    estimatedMinutes: -15,
  };
  const negativeResult = validateTask(negativeTask);
  assert.equal(negativeResult.isValid, false);
  assert.ok(negativeResult.errors.some((e) => e.includes('estimatedMinutes')));
});

test('Task: Status transitions and completedAt lifecycle', () => {
  const task = createTask({
    roadmapId: generateEntityId(),
    title: 'Write Unit Tests',
  });

  assert.equal(task.status, 'todo');
  assert.equal(canTransitionTaskStatus('todo', 'in_progress'), true);
  assert.equal(canTransitionTaskStatus('cancelled', 'completed'), false);

  // Transition to in_progress
  const inProgressTask = transitionTaskStatus(task, 'in_progress');
  assert.equal(inProgressTask.status, 'in_progress');
  assert.equal(inProgressTask.completedAt, undefined);

  // Transition to completed (should populate completedAt)
  const completedTask = transitionTaskStatus(inProgressTask, 'completed');
  assert.equal(completedTask.status, 'completed');
  assert.ok(isValidTimestamp(completedTask.completedAt!));

  const completedValidation = validateTask(completedTask);
  assert.equal(completedValidation.isValid, true);

  // Reopen completed task to in_progress (should clear completedAt)
  const reopenedTask = transitionTaskStatus(completedTask, 'in_progress');
  assert.equal(reopenedTask.status, 'in_progress');
  assert.equal(reopenedTask.completedAt, undefined);

  // Illegal transition should throw
  const cancelledTask = transitionTaskStatus(reopenedTask, 'cancelled');
  assert.throws(() => {
    transitionTaskStatus(cancelledTask, 'completed');
  }, /Illegal Task status transition/);
});

test('Session: Activity recording, valid duration, and time range constraints', () => {
  const taskId = generateEntityId();
  const startedAt = '2026-09-20T14:00:00.000Z';
  const endedAt = '2026-09-20T14:45:00.000Z';

  const session = createSession({
    taskId,
    startedAt,
    endedAt,
  });

  assert.ok(isValidEntityId(session.id));
  assert.equal(session.taskId, taskId);
  assert.equal(session.durationMinutes, 45, 'Automatically derives duration from start and end');

  const validRes = validateSession(session);
  assert.equal(validRes.isValid, true);

  // Invalid: endedAt precedes startedAt
  const invalidTimeSession = {
    ...session,
    startedAt: '2026-09-20T15:00:00.000Z',
    endedAt: '2026-09-20T14:00:00.000Z',
  };
  const invalidTimeRes = validateSession(invalidTimeSession);
  assert.equal(invalidTimeRes.isValid, false);
  assert.ok(invalidTimeRes.errors.some((e) => e.includes('precede')));

  // Invalid: negative durationMinutes
  const negativeDurationSession = {
    ...session,
    durationMinutes: -10,
  };
  const negativeDurationRes = validateSession(negativeDurationSession);
  assert.equal(negativeDurationRes.isValid, false);
  assert.ok(negativeDurationRes.errors.some((e) => e.includes('negative')));
});

test('Weekly Plan: References Task without duplication and validates planned items', () => {
  const taskId = generateEntityId();
  const planItem = createWeeklyPlanItem({
    taskId,
    targetDate: '2026-09-18',
    plannedMinutes: 60,
  });

  assert.equal(planItem.taskId, taskId);
  assert.equal(planItem.plannedMinutes, 60);
  assert.equal(planItem.isCompleted, false);
  assert.ok(isValidEntityId(planItem.weeklyPlanId));

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    title: 'Sprint 38 Commitments',
    targetMinutes: 180,
    items: [planItem],
  });

  assert.equal(plan.weekIdentifier, '2026-W38');
  assert.equal(plan.targetMinutes, 180);
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].taskId, taskId);
  assert.equal(plan.items[0].weeklyPlanId, plan.id, 'createWeeklyPlan assigns plan ID to child items');

  const planValidation = validateWeeklyPlan(plan);
  assert.equal(planValidation.isValid, true);

  // Invalid item with negative plannedMinutes
  const invalidItem = {
    ...planItem,
    plannedMinutes: -20,
  };
  const itemValidation = validateWeeklyPlanItem(invalidItem);
  assert.equal(itemValidation.isValid, false);
  assert.ok(itemValidation.errors.some((e) => e.includes('negative')));

  // Invalid plan with negative targetMinutes
  const negativeTargetPlan = {
    ...plan,
    targetMinutes: -60,
  };
  const negativeTargetValidation = validateWeeklyPlan(negativeTargetPlan);
  assert.equal(negativeTargetValidation.isValid, false);
  assert.ok(negativeTargetValidation.errors.some((e) => e.includes('targetMinutes')));
});

test('Progress Service: Deterministic calculation across tasks and edge cases', () => {
  // Empty array edge case: must not divide by zero or crash
  const emptySummary = calculateTaskProgress([]);
  assert.equal(emptySummary.totalTasks, 0);
  assert.equal(emptySummary.completedTasks, 0);
  assert.equal(emptySummary.completionPercentage, 0);
  assert.equal(emptySummary.totalEstimatedMinutes, 0);

  const roadmapId = generateEntityId();
  const task1 = createTask({
    roadmapId,
    title: 'Task 1',
    status: 'completed',
    estimatedMinutes: 60,
  });
  const task2 = createTask({
    roadmapId,
    title: 'Task 2',
    status: 'in_progress',
    estimatedMinutes: 90,
  });
  const task3 = createTask({
    roadmapId,
    title: 'Task 3',
    status: 'todo',
    estimatedMinutes: 30,
  });
  const task4 = createTask({
    roadmapId,
    title: 'Task 4',
    status: 'cancelled',
    estimatedMinutes: 120,
  });

  const summary = calculateTaskProgress([task1, task2, task3, task4]);
  assert.equal(summary.totalTasks, 4);
  assert.equal(summary.completedTasks, 1);
  assert.equal(summary.inProgressTasks, 1);
  assert.equal(summary.todoTasks, 1);
  assert.equal(summary.cancelledTasks, 1);
  // Active/completed total is 3 (ignoring cancelled). 1 out of 3 = 33%
  assert.equal(summary.completionPercentage, 33);
  assert.equal(summary.totalEstimatedMinutes, 300);
  assert.equal(summary.completedEstimatedMinutes, 60);
});

test('Progress Service: Aggregates Session and Weekly Plan progress', () => {
  const taskId1 = generateEntityId();
  const taskId2 = generateEntityId();

  const session1 = createSession({
    taskId: taskId1,
    startedAt: '2026-09-20T09:00:00.000Z',
    endedAt: '2026-09-20T09:30:00.000Z', // 30 min
  });
  const session2 = createSession({
    taskId: taskId1,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T11:00:00.000Z', // 60 min
  });

  const sessionSummary = calculateSessionProgress([session1, session2]);
  assert.equal(sessionSummary.totalSessions, 2);
  assert.equal(sessionSummary.totalActualMinutes, 90);
  assert.equal(sessionSummary.averageSessionMinutes, 45);

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [
      createWeeklyPlanItem({
        taskId: taskId1,
        targetDate: '2026-09-20',
        plannedMinutes: 60,
        isCompleted: true,
      }),
      createWeeklyPlanItem({
        taskId: taskId2,
        targetDate: '2026-09-21',
        plannedMinutes: 60,
        isCompleted: false,
      }),
    ],
  });

  const weeklyProgress = calculateWeeklyPlanProgress(plan, [session1, session2]);
  assert.equal(weeklyProgress.totalPlannedItems, 2);
  assert.equal(weeklyProgress.completedPlannedItems, 1);
  assert.equal(weeklyProgress.totalPlannedMinutes, 120);
  // Only sessions for taskId1 are counted for taskId1 item (90 mins total)
  assert.equal(weeklyProgress.totalActualMinutes, 90);
  assert.equal(weeklyProgress.itemCompletionPercentage, 50);
  // 90 actual - 120 planned = -30 min variance
  assert.equal(weeklyProgress.varianceMinutes, -30);
});

test('Progress Service: Aggregated Roadmap and Goal progress calculations', () => {
  const goal = createGoal({ title: 'Grand Objective' });
  const roadmap1 = createRoadmap({ goalId: goal.id, title: 'Milestone Alpha' });
  const roadmap2 = createRoadmap({ goalId: goal.id, title: 'Milestone Beta' });

  const t1 = createTask({
    roadmapId: roadmap1.id,
    title: 'T1',
    status: 'completed',
    estimatedMinutes: 50,
  });
  const t2 = createTask({
    roadmapId: roadmap1.id,
    title: 'T2',
    status: 'todo',
    estimatedMinutes: 50,
  });
  const t3 = createTask({
    roadmapId: roadmap2.id,
    title: 'T3',
    status: 'completed',
    estimatedMinutes: 100,
  });

  const s1 = createSession({
    taskId: t1.id,
    startedAt: '2026-09-20T08:00:00.000Z',
    endedAt: '2026-09-20T08:50:00.000Z',
  });

  // Roadmap 1 progress
  const r1Progress = calculateRoadmapProgress(roadmap1.id, [t1, t2, t3], [s1]);
  assert.equal(r1Progress.roadmapId, roadmap1.id);
  assert.equal(r1Progress.taskSummary.totalTasks, 2);
  assert.equal(r1Progress.taskSummary.completedTasks, 1);
  assert.equal(r1Progress.taskSummary.completionPercentage, 50);
  assert.equal(r1Progress.sessionSummary.totalActualMinutes, 50);

  // Goal progress
  const goalProgress = calculateGoalProgress(
    goal.id,
    [roadmap1, roadmap2],
    [t1, t2, t3],
    [s1]
  );
  assert.equal(goalProgress.goalId, goal.id);
  assert.equal(goalProgress.totalRoadmaps, 2);
  assert.equal(goalProgress.taskSummary.totalTasks, 3);
  assert.equal(goalProgress.taskSummary.completedTasks, 2);
  assert.equal(goalProgress.taskSummary.completionPercentage, 67);
  assert.equal(goalProgress.sessionSummary.totalActualMinutes, 50);
});
