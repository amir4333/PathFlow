/**
 * Phase 5 Unit Tests: Weekly Planning System
 *
 * Exhaustive test coverage for:
 * 1. Flexible planning styles: Weekly-only, Daily allocation, and Mixed/hybrid commitments
 * 2. Multi-task planning, multi-day task allocation, and multi-week recurring task planning
 * 3. Strict domain invariants: week identifier format, valid dates, week boundary matching,
 *    non-negative minutes, duplicate item detection
 * 4. Calculations: planned minutes by task/roadmap/goal/plan, daily breakdown (Mon-Sun),
 *    date-specific queries, task completion vs. time completion metrics
 * 5. Planned vs. Actual integration: week isolation, task isolation, variance, remaining time,
 *    and weekly progress summaries
 * 6. Repository persistence, query operations, and offline resilience
 * 7. Unified domain architecture for Academic Learning & Game Systems Lab
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import {
  generateEntityId,
  createTimestamp,
  getWeekIdentifier,
  getWeekDateRange,
  isValidWeekIdentifier,
  isValidDateString,
  createGoal,
  createRoadmap,
  createTask,
  createSession,
  createWeeklyPlan,
  createWeeklyPlanItem,
  updateWeeklyPlan,
  addWeeklyPlanItem,
  removeWeeklyPlanItem,
  toggleWeeklyPlanItemCompletion,
  validateWeeklyPlan,
  validateWeeklyPlanItem,
  WeeklyPlan,
  WeeklyPlanItem,
  calculateTaskPlannedMinutesInPlan,
  calculateRoadmapPlannedMinutesInPlan,
  calculateGoalPlannedMinutesInPlan,
  calculateWeeklyPlanTotalPlannedMinutes,
  calculateDatePlannedMinutes,
  calculateWeeklyPlanDailyBreakdown,
  calculateWeeklyTaskCompletion,
  calculateWeeklyPlanActualMinutesInWeek,
  calculateWeeklyProgressSummary,
} from '../../src/domain';

import { PathFlowDB } from '../../src/data/local/database';
import {
  DexieGoalRepository,
  DexieRoadmapRepository,
  DexieTaskRepository,
  DexieSessionRepository,
  DexieWeeklyPlanRepository,
  DexieWeeklyPlanItemRepository,
} from '../../src/data/repositories';
import { DomainValidationError, EntityNotFoundError } from '../../src/data/errors';

function setupRepositories() {
  const dbName = `pathflow-weekly-test-${generateEntityId()}`;
  const db = new PathFlowDB(dbName);
  const repos = {
    goals: new DexieGoalRepository(db),
    roadmaps: new DexieRoadmapRepository(db),
    tasks: new DexieTaskRepository(db),
    sessions: new DexieSessionRepository(db),
    weeklyPlans: new DexieWeeklyPlanRepository(db),
    weeklyPlanItems: new DexieWeeklyPlanItemRepository(db),
  };
  return { db, repos };
}

// -----------------------------------------------------------------------------
// 1. Creation and Flexible Planning Styles
// -----------------------------------------------------------------------------

test('Weekly Planning: Creates plan with Weekly-only commitments (no daily allocation)', () => {
  const taskId1 = generateEntityId();
  const taskId2 = generateEntityId();

  // Items without targetDate represent weekly commitments
  const item1 = createWeeklyPlanItem({
    taskId: taskId1,
    plannedMinutes: 120,
  });
  const item2 = createWeeklyPlanItem({
    taskId: taskId2,
    plannedMinutes: 90,
  });

  assert.equal(item1.targetDate, undefined);
  assert.equal(item2.targetDate, undefined);

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    title: 'Focus Week 38',
    items: [item1, item2],
  });

  // Target minutes should automatically default to the sum of item planned minutes (210)
  assert.equal(plan.targetMinutes, 210);
  assert.equal(plan.items.length, 2);
  assert.equal(plan.weekIdentifier, '2026-W38');

  const validation = validateWeeklyPlan(plan);
  assert.equal(validation.isValid, true, 'Weekly-only plan should be completely valid');
});

test('Weekly Planning: Creates plan with Daily allocations (assigned to specific calendar dates)', () => {
  const taskId = generateEntityId();
  // 2026-W38 is Monday 2026-09-14 to Sunday 2026-09-20
  const mondayItem = createWeeklyPlanItem({
    taskId,
    targetDate: '2026-09-14',
    plannedMinutes: 60,
  });
  const wednesdayItem = createWeeklyPlanItem({
    taskId,
    targetDate: '2026-09-16',
    plannedMinutes: 45,
  });
  const fridayItem = createWeeklyPlanItem({
    taskId,
    targetDate: '2026-09-18',
    plannedMinutes: 75,
  });

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    title: 'Daily Scheduled Week',
    targetMinutes: 180,
    items: [mondayItem, wednesdayItem, fridayItem],
  });

  assert.equal(plan.items.length, 3);
  assert.equal(plan.items[0].targetDate, '2026-09-14');
  assert.equal(plan.items[1].targetDate, '2026-09-16');
  assert.equal(plan.items[2].targetDate, '2026-09-18');

  const validation = validateWeeklyPlan(plan);
  assert.equal(validation.isValid, true);
});

test('Weekly Planning: Supports Mixed/Hybrid commitments in the same plan', () => {
  const taskA = generateEntityId();
  const taskB = generateEntityId();

  // Task A has a specific day scheduled
  const dailyItem = createWeeklyPlanItem({
    taskId: taskA,
    targetDate: '2026-09-15',
    plannedMinutes: 90,
  });
  // Task B is a flexible weekly goal with no fixed day
  const weeklyItem = createWeeklyPlanItem({
    taskId: taskB,
    plannedMinutes: 120,
  });

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [dailyItem, weeklyItem],
  });

  assert.equal(plan.items.length, 2);
  const validation = validateWeeklyPlan(plan);
  assert.equal(validation.isValid, true);
});

test('Weekly Planning: Pure functional plan modification helpers', () => {
  const task1 = generateEntityId();
  const task2 = generateEntityId();

  let plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    title: 'Original Title',
    targetMinutes: 100,
  });
  const originalCreated = plan.createdAt;

  // Add item
  plan = addWeeklyPlanItem(plan, {
    taskId: task1,
    targetDate: '2026-09-14',
    plannedMinutes: 60,
  });
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].taskId, task1);
  assert.equal(plan.createdAt, originalCreated);

  // Add second item
  plan = addWeeklyPlanItem(plan, {
    taskId: task2,
    plannedMinutes: 45,
  });
  assert.equal(plan.items.length, 2);

  // Toggle completion
  const item1Id = plan.items[0].id;
  plan = toggleWeeklyPlanItemCompletion(plan, item1Id, true);
  assert.equal(plan.items.find((i) => i.id === item1Id)?.isCompleted, true);

  // Remove item
  plan = removeWeeklyPlanItem(plan, item1Id);
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].taskId, task2);

  // Update plan metadata
  plan = updateWeeklyPlan(plan, { title: 'Updated Title', targetMinutes: 300 });
  assert.equal(plan.title, 'Updated Title');
  assert.equal(plan.targetMinutes, 300);
});

// -----------------------------------------------------------------------------
// 2. Strict Domain Invariants & Validation
// -----------------------------------------------------------------------------

test('Weekly Plan Invariants: Rejects invalid week identifiers', () => {
  assert.equal(isValidWeekIdentifier('2026-W38'), true);
  assert.equal(isValidWeekIdentifier('2026-W01'), true);
  assert.equal(isValidWeekIdentifier('2026-W53'), true);
  assert.equal(isValidWeekIdentifier('2026-W00'), false);
  assert.equal(isValidWeekIdentifier('2026-W54'), false);
  assert.equal(isValidWeekIdentifier('2026-38'), false);
  assert.equal(isValidWeekIdentifier('invalid-week'), false);
  assert.equal(isValidWeekIdentifier(''), false);

  const invalidPlan = createWeeklyPlan({
    weekIdentifier: 'invalid-week',
    title: 'Bad Week Plan',
  });
  const res = validateWeeklyPlan(invalidPlan);
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some((e) => e.includes('weekIdentifier')));
});

test('Weekly Plan Invariants: Rejects invalid calendar dates and out-of-week allocations', () => {
  assert.equal(isValidDateString('2026-09-14'), true);
  assert.equal(isValidDateString('2026-02-28'), true);
  assert.equal(isValidDateString('2026-02-29'), false, '2026 is not a leap year');
  assert.equal(isValidDateString('2026-02-30'), false);
  assert.equal(isValidDateString('not-a-date'), false);

  const taskId = generateEntityId();

  // Test invalid date format in item
  const invalidDateItem = createWeeklyPlanItem({
    taskId,
    targetDate: '2026-02-30',
    plannedMinutes: 30,
  });
  const itemRes = validateWeeklyPlanItem(invalidDateItem);
  assert.equal(itemRes.isValid, false);
  assert.ok(itemRes.errors.some((e) => e.includes('not a valid calendar date')));

  // Test item belonging to a different week than the plan
  // 2026-09-28 is in week 2026-W40, not 2026-W38
  const outOfWeekItem = createWeeklyPlanItem({
    taskId,
    targetDate: '2026-09-28',
    plannedMinutes: 60,
  });
  const mismatchedPlan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [outOfWeekItem],
  });
  const planRes = validateWeeklyPlan(mismatchedPlan);
  assert.equal(planRes.isValid, false);
  assert.ok(planRes.errors.some((e) => e.includes('does not match plan weekIdentifier')));
});

test('Weekly Plan Invariants: Rejects duplicate allocations and negative minutes', () => {
  const taskId = generateEntityId();

  // Negative planned minutes (bypassing factory clamp)
  const negItem: WeeklyPlanItem = {
    id: generateEntityId(),
    weeklyPlanId: generateEntityId(),
    taskId,
    plannedMinutes: -15,
    isCompleted: false,
  };
  const negItemRes = validateWeeklyPlanItem(negItem);
  assert.equal(negItemRes.isValid, false);
  assert.ok(negItemRes.errors.some((e) => e.includes('negative')));

  // Negative target minutes (bypassing factory clamp)
  const negTargetPlan: WeeklyPlan = {
    ...createWeeklyPlan({ weekIdentifier: '2026-W38' }),
    targetMinutes: -60,
  };
  const negPlanRes = validateWeeklyPlan(negTargetPlan);
  assert.equal(negPlanRes.isValid, false);
  assert.ok(negPlanRes.errors.some((e) => e.includes('targetMinutes')));
  assert.equal(validateWeeklyPlan(negTargetPlan).isValid, false);

  // Duplicate daily allocation for the same task on the same date
  const item1 = createWeeklyPlanItem({
    taskId,
    targetDate: '2026-09-14',
    plannedMinutes: 30,
  });
  const duplicateItem = createWeeklyPlanItem({
    taskId,
    targetDate: '2026-09-14',
    plannedMinutes: 45,
  });
  const dupPlan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [item1, duplicateItem],
  });
  const dupRes = validateWeeklyPlan(dupPlan);
  assert.equal(dupRes.isValid, false);
  assert.ok(dupRes.errors.some((e) => e.includes('Duplicate daily allocation')));

  // Duplicate unallocated weekly commitments for the same task
  const unallocated1 = createWeeklyPlanItem({
    taskId,
    plannedMinutes: 60,
  });
  const unallocated2 = createWeeklyPlanItem({
    taskId,
    plannedMinutes: 60,
  });
  const dupUnallocatedPlan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [unallocated1, unallocated2],
  });
  const dupUnallocatedRes = validateWeeklyPlan(dupUnallocatedPlan);
  assert.equal(dupUnallocatedRes.isValid, false);
  assert.ok(dupUnallocatedRes.errors.some((e) => e.includes('Duplicate unallocated weekly commitment')));
});

// -----------------------------------------------------------------------------
// 3. Planned Minutes & Breakdown Calculations
// -----------------------------------------------------------------------------

test('Weekly Planning Calculations: Calculates planned minutes across Task, Roadmap, Goal, and Plan', () => {
  const goalId = generateEntityId();
  const roadmap1Id = generateEntityId();
  const roadmap2Id = generateEntityId();

  const roadmaps = [
    createRoadmap({ id: roadmap1Id, goalId, title: 'Roadmap 1' }),
    createRoadmap({ id: roadmap2Id, goalId, title: 'Roadmap 2' }),
  ];

  const task1 = createTask({ roadmapId: roadmap1Id, title: 'Task 1' });
  const task2 = createTask({ roadmapId: roadmap1Id, title: 'Task 2' });
  const task3 = createTask({ roadmapId: roadmap2Id, title: 'Task 3' });
  const tasks = [task1, task2, task3];

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [
      createWeeklyPlanItem({ taskId: task1.id, targetDate: '2026-09-14', plannedMinutes: 60 }),
      createWeeklyPlanItem({ taskId: task1.id, targetDate: '2026-09-16', plannedMinutes: 30 }),
      createWeeklyPlanItem({ taskId: task2.id, targetDate: '2026-09-15', plannedMinutes: 90 }),
      createWeeklyPlanItem({ taskId: task3.id, plannedMinutes: 120 }), // weekly unallocated
    ],
  });

  // Task-level: task1 has 60 + 30 = 90
  assert.equal(calculateTaskPlannedMinutesInPlan(task1.id, plan), 90);
  assert.equal(calculateTaskPlannedMinutesInPlan(task2.id, plan), 90);
  assert.equal(calculateTaskPlannedMinutesInPlan(task3.id, plan), 120);

  // Roadmap-level: Roadmap 1 has task1 (90) + task2 (90) = 180
  assert.equal(calculateRoadmapPlannedMinutesInPlan(roadmap1Id, tasks, plan), 180);
  assert.equal(calculateRoadmapPlannedMinutesInPlan(roadmap2Id, tasks, plan), 120);

  // Goal-level: all tasks belong to goalId -> 90 + 90 + 120 = 300
  assert.equal(calculateGoalPlannedMinutesInPlan(goalId, roadmaps, tasks, plan), 300);

  // Total plan
  assert.equal(calculateWeeklyPlanTotalPlannedMinutes(plan), 300);
});

test('Weekly Planning Calculations: Generates full 7-day breakdown and isolates unallocated time', () => {
  const taskId = generateEntityId();
  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [
      createWeeklyPlanItem({ taskId, targetDate: '2026-09-14', plannedMinutes: 60 }), // Monday
      createWeeklyPlanItem({ taskId, targetDate: '2026-09-18', plannedMinutes: 45 }), // Friday
      createWeeklyPlanItem({ taskId, plannedMinutes: 90 }), // Unallocated
    ],
  });

  const breakdown = calculateWeeklyPlanDailyBreakdown(plan);
  assert.equal(breakdown.weekIdentifier, '2026-W38');
  assert.equal(breakdown.days.length, 7);

  // Monday
  assert.equal(breakdown.days[0].date, '2026-09-14');
  assert.equal(breakdown.days[0].dayOfWeek, 1);
  assert.equal(breakdown.days[0].plannedMinutes, 60);

  // Tuesday (no planned items)
  assert.equal(breakdown.days[1].date, '2026-09-15');
  assert.equal(breakdown.days[1].dayOfWeek, 2);
  assert.equal(breakdown.days[1].plannedMinutes, 0);

  // Friday
  assert.equal(breakdown.days[4].date, '2026-09-18');
  assert.equal(breakdown.days[4].dayOfWeek, 5);
  assert.equal(breakdown.days[4].plannedMinutes, 45);

  // Unallocated
  assert.equal(breakdown.unallocatedMinutes, 90);
  assert.equal(breakdown.totalPlannedMinutes, 195);

  // Date-specific calculation
  assert.equal(calculateDatePlannedMinutes('2026-09-14', plan), 60);
  assert.equal(calculateDatePlannedMinutes('2026-09-15', plan), 0);
  assert.equal(calculateDatePlannedMinutes('2026-09-18', plan), 45);
});

// -----------------------------------------------------------------------------
// 4. Task Completion vs. Time Completion
// -----------------------------------------------------------------------------

test('Weekly Planning Metrics: Accurately distinguishes Task Completion from Time Completion', () => {
  const dummyRoadmapId = generateEntityId();
  const task1 = createTask({ roadmapId: dummyRoadmapId, title: 'Task 1', status: 'completed' });
  const task2 = createTask({ roadmapId: dummyRoadmapId, title: 'Task 2', status: 'todo' });

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [
      createWeeklyPlanItem({ taskId: task1.id, plannedMinutes: 120, isCompleted: true }),
      createWeeklyPlanItem({ taskId: task2.id, plannedMinutes: 60, isCompleted: false }),
    ],
  });

  // Task 1 is completed early in 45 minutes
  const sessions = [
    createSession({
      taskId: task1.id,
      startedAt: '2026-09-14T10:00:00.000Z',
      endedAt: '2026-09-14T10:45:00.000Z', // 45 min
    }),
  ];

  const summary = calculateWeeklyProgressSummary(plan, sessions, [task1, task2]);

  // Task completion: 1 of 2 tasks is finished -> 50%
  assert.equal(summary.plannedTaskCount, 2);
  assert.equal(summary.completedTaskCount, 1);
  assert.equal(summary.remainingTaskCount, 1);
  assert.equal(summary.taskCompletionPercentage, 50);

  // Time completion: 45 minutes logged out of 180 planned -> 25%
  assert.equal(summary.plannedMinutes, 180);
  assert.equal(summary.actualMinutes, 45);
  assert.equal(summary.timeCompletionPercentage, 25);
  assert.equal(summary.varianceMinutes, -135);
  assert.equal(summary.remainingMinutes, 135);
});

test('Weekly Planning Metrics: Handles over-time task completion (actual > planned)', () => {
  const dummyRoadmapId = generateEntityId();
  const task = createTask({ roadmapId: dummyRoadmapId, title: 'Deep Work Task', status: 'completed' });

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [
      createWeeklyPlanItem({ taskId: task.id, plannedMinutes: 60, isCompleted: true }),
    ],
  });

  // Took 90 minutes instead of 60
  const sessions = [
    createSession({
      taskId: task.id,
      startedAt: '2026-09-14T10:00:00.000Z',
      endedAt: '2026-09-14T11:30:00.000Z', // 90 min
    }),
  ];

  const summary = calculateWeeklyProgressSummary(plan, sessions, [task]);
  assert.equal(summary.actualMinutes, 90);
  assert.equal(summary.plannedMinutes, 60);
  assert.equal(summary.varianceMinutes, 30, 'Positive variance indicates overtime');
  assert.equal(summary.remainingMinutes, 0, 'No remaining planned minutes when exceeded');
  assert.equal(summary.timeCompletionPercentage, 150);
});

// -----------------------------------------------------------------------------
// 5. Planned vs. Actual Integration & Isolation
// -----------------------------------------------------------------------------

test('Planned vs Actual: Enforces strict Week and Task Isolation', () => {
  const dummyRoadmapId = generateEntityId();
  const plannedTask = createTask({ roadmapId: dummyRoadmapId, title: 'Planned Task' });
  const unplannedTask = createTask({ roadmapId: dummyRoadmapId, title: 'Unplanned Task' });

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38', // 2026-09-14 to 2026-09-20
    items: [
      createWeeklyPlanItem({ taskId: plannedTask.id, plannedMinutes: 100 }),
    ],
  });

  const sessions = [
    // Valid: In week 38 on planned task -> 50 min
    createSession({
      taskId: plannedTask.id,
      startedAt: '2026-09-15T10:00:00.000Z',
      endedAt: '2026-09-15T10:50:00.000Z',
    }),
    // Excluded: In week 38, but on UNPLANNED task -> 40 min
    createSession({
      taskId: unplannedTask.id,
      startedAt: '2026-09-15T11:00:00.000Z',
      endedAt: '2026-09-15T11:40:00.000Z',
    }),
    // Excluded: Planned task, but in Week 39 (2026-09-21) -> 60 min
    createSession({
      taskId: plannedTask.id,
      startedAt: '2026-09-21T10:00:00.000Z',
      endedAt: '2026-09-21T11:00:00.000Z',
    }),
  ];

  const actualMinutes = calculateWeeklyPlanActualMinutesInWeek(plan, sessions);
  assert.equal(actualMinutes, 50, 'Only sessions within the week for planned tasks are counted');
});

// -----------------------------------------------------------------------------
// 6. Persistence, History Preservation, and Queries
// -----------------------------------------------------------------------------

test('Persistence: WeeklyPlan and WeeklyPlanItem repository CRUD and queries', async () => {
  const { db, repos } = setupRepositories();

  const goal = await repos.goals.create(createGoal({ title: 'Mastering Systems' }));
  const roadmap = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Rust Core' }));
  const task1 = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Ownership & Borrowing' }));
  const task2 = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Lifetimes' }));

  // Create plan with daily allocations and weekly commitment
  const plan = await repos.weeklyPlans.create(
    createWeeklyPlan({
      weekIdentifier: '2026-W38',
      title: 'Rust Immersion',
      targetMinutes: 240,
      items: [
        createWeeklyPlanItem({ taskId: task1.id, targetDate: '2026-09-14', plannedMinutes: 120 }),
        createWeeklyPlanItem({ taskId: task2.id, plannedMinutes: 120 }),
      ],
    })
  );

  assert.equal(plan.weekIdentifier, '2026-W38');
  assert.equal(plan.items.length, 2);

  // Retrieve by ID
  const retrievedById = await repos.weeklyPlans.getById(plan.id);
  assert.ok(retrievedById);
  assert.equal(retrievedById?.title, 'Rust Immersion');
  assert.equal(retrievedById?.items.length, 2);

  // Retrieve by weekIdentifier
  const retrievedByWeek = await repos.weeklyPlans.getByWeekIdentifier('2026-W38');
  assert.ok(retrievedByWeek);
  assert.equal(retrievedByWeek?.id, plan.id);

  // Query by taskId
  const plansForTask = await repos.weeklyPlans.getByTaskId(task1.id);
  assert.equal(plansForTask.length, 1);
  assert.equal(plansForTask[0].id, plan.id);

  // Query items by date
  const itemsOnMonday = await repos.weeklyPlanItems.getByDate('2026-09-14');
  assert.equal(itemsOnMonday.length, 1);
  assert.equal(itemsOnMonday[0].taskId, task1.id);

  // Query unallocated items
  const unallocatedItems = await repos.weeklyPlanItems.getUnallocatedByPlanId(plan.id);
  assert.equal(unallocatedItems.length, 1);
  assert.equal(unallocatedItems[0].taskId, task2.id);

  await db.close();
});

test('Persistence: Updates preserve historical creation timestamp and sync items', async () => {
  const { db, repos } = setupRepositories();

  const goal = await repos.goals.create(createGoal({ title: 'Goal' }));
  const roadmap = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Roadmap' }));
  const task = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Task' }));

  const plan = await repos.weeklyPlans.create(
    createWeeklyPlan({
      weekIdentifier: '2026-W38',
      title: 'Initial Plan',
      items: [createWeeklyPlanItem({ taskId: task.id, plannedMinutes: 60 })],
    })
  );

  const originalCreatedAt = plan.createdAt;

  // Wait a tiny fraction to ensure timestamp difference
  await new Promise((r) => setTimeout(r, 10));

  // Update plan with modified targetMinutes and new item
  const updatedPlan = updateWeeklyPlan(plan, {
    title: 'Revised Plan',
    targetMinutes: 180,
    items: [
      createWeeklyPlanItem({ taskId: task.id, targetDate: '2026-09-15', plannedMinutes: 90 }),
    ],
  });

  const persisted = await repos.weeklyPlans.update(updatedPlan);
  assert.equal(persisted.title, 'Revised Plan');
  assert.equal(persisted.createdAt, originalCreatedAt, 'Original creation timestamp preserved');
  assert.notEqual(persisted.updatedAt, originalCreatedAt, 'updatedAt was refreshed');

  // Verify items synced in repository
  const reloaded = await repos.weeklyPlans.getById(plan.id);
  assert.equal(reloaded?.items.length, 1);
  assert.equal(reloaded?.items[0].plannedMinutes, 90);
  assert.equal(reloaded?.items[0].targetDate, '2026-09-15');

  await db.close();
});

test('Persistence: Historical independence (Week 38 and Week 39 remain strictly separate)', async () => {
  const { db, repos } = setupRepositories();

  const goal = await repos.goals.create(createGoal({ title: 'Goal' }));
  const roadmap = await repos.roadmaps.create(createRoadmap({ goalId: goal.id, title: 'Roadmap' }));
  const task = await repos.tasks.create(createTask({ roadmapId: roadmap.id, title: 'Long-running Task' }));

  // Week 38 Plan
  const planW38 = await repos.weeklyPlans.create(
    createWeeklyPlan({
      weekIdentifier: '2026-W38',
      title: 'Week 38',
      items: [createWeeklyPlanItem({ taskId: task.id, plannedMinutes: 100 })],
    })
  );

  // Week 39 Plan
  const planW39 = await repos.weeklyPlans.create(
    createWeeklyPlan({
      weekIdentifier: '2026-W39',
      title: 'Week 39',
      items: [createWeeklyPlanItem({ taskId: task.id, plannedMinutes: 150 })],
    })
  );

  // Verify both plans exist independently
  const loadedW38 = await repos.weeklyPlans.getByWeekIdentifier('2026-W38');
  const loadedW39 = await repos.weeklyPlans.getByWeekIdentifier('2026-W39');

  assert.equal(loadedW38?.id, planW38.id);
  assert.equal(loadedW39?.id, planW39.id);
  assert.equal(loadedW38?.items[0].plannedMinutes, 100);
  assert.equal(loadedW39?.items[0].plannedMinutes, 150);

  // Modifying week 39 does not alter week 38
  const modifiedW39 = updateWeeklyPlan(planW39, {
    items: [createWeeklyPlanItem({ taskId: task.id, plannedMinutes: 200 })],
  });
  await repos.weeklyPlans.update(modifiedW39);

  const reloadedW38 = await repos.weeklyPlans.getByWeekIdentifier('2026-W38');
  assert.equal(reloadedW38?.items[0].plannedMinutes, 100, 'Week 38 remains untouched');

  await db.close();
});

test('Persistence: Data survives database closing and reopening', async () => {
  const dbName = `pathflow-reopen-test-${generateEntityId()}`;
  const db1 = new PathFlowDB(dbName);
  const planRepo1 = new DexieWeeklyPlanRepository(db1);
  const taskRepo1 = new DexieTaskRepository(db1);
  const roadmapRepo1 = new DexieRoadmapRepository(db1);
  const goalRepo1 = new DexieGoalRepository(db1);

  const goal = await goalRepo1.create(createGoal({ title: 'G' }));
  const roadmap = await roadmapRepo1.create(createRoadmap({ goalId: goal.id, title: 'R' }));
  const task = await taskRepo1.create(createTask({ roadmapId: roadmap.id, title: 'T' }));

  const plan = await planRepo1.create(
    createWeeklyPlan({
      weekIdentifier: '2026-W38',
      title: 'Persistent Plan',
      items: [createWeeklyPlanItem({ taskId: task.id, targetDate: '2026-09-14', plannedMinutes: 60 })],
    })
  );

  await db1.close();

  // Reopen
  const db2 = new PathFlowDB(dbName);
  const planRepo2 = new DexieWeeklyPlanRepository(db2);
  const reloaded = await planRepo2.getByWeekIdentifier('2026-W38');

  assert.ok(reloaded);
  assert.equal(reloaded?.id, plan.id);
  assert.equal(reloaded?.title, 'Persistent Plan');
  assert.equal(reloaded?.items.length, 1);
  assert.equal(reloaded?.items[0].plannedMinutes, 60);

  await db2.close();
});

// -----------------------------------------------------------------------------
// 7. Unified Domain Architecture: Academic Learning & Game Systems Lab
// -----------------------------------------------------------------------------

test('Unified Domain Architecture: Academic Learning and Game Systems Lab share single weekly plan without bifurcation', async () => {
  const { db, repos } = setupRepositories();

  // Academic Goal & Tasks
  const academicGoal = await repos.goals.create(
    createGoal({ title: 'Master Computer Science', description: 'Academic Focus' })
  );
  const academicRoadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: academicGoal.id, title: 'Data Structures & Algorithms' })
  );
  const dsTask = await repos.tasks.create(
    createTask({ roadmapId: academicRoadmap.id, title: 'Binary Search Trees & Balancing' })
  );

  // Game Systems Lab Goal & Tasks
  const gslGoal = await repos.goals.create(
    createGoal({ title: 'Game Systems Lab Engineering', description: 'Game Systems Lab' })
  );
  const gslRoadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: gslGoal.id, title: 'ECS & Spatial Partitioning' })
  );
  const ecsTask = await repos.tasks.create(
    createTask({ roadmapId: gslRoadmap.id, title: 'Spatial Grid Query Optimization' })
  );

  // Single unified plan for 2026-W38 holding both commitments
  const unifiedPlan = await repos.weeklyPlans.create(
    createWeeklyPlan({
      weekIdentifier: '2026-W38',
      title: 'Unified Sprint 38: Academics & Game Systems',
      items: [
        createWeeklyPlanItem({
          taskId: dsTask.id,
          targetDate: '2026-09-14', // Monday
          plannedMinutes: 90,
        }),
        createWeeklyPlanItem({
          taskId: ecsTask.id,
          targetDate: '2026-09-15', // Tuesday
          plannedMinutes: 120,
        }),
      ],
    })
  );

  assert.equal(unifiedPlan.items.length, 2);

  // Sessions logged in week 38
  const sessions = [
    // 90 minutes on Data Structures
    await repos.sessions.create(
      createSession({
        taskId: dsTask.id,
        startedAt: '2026-09-14T09:00:00.000Z',
        endedAt: '2026-09-14T10:30:00.000Z',
      })
    ),
    // 60 minutes on ECS (half of planned 120m)
    await repos.sessions.create(
      createSession({
        taskId: ecsTask.id,
        startedAt: '2026-09-15T14:00:00.000Z',
        endedAt: '2026-09-15T15:00:00.000Z',
      })
    ),
  ];

  // Domain calculations on unified plan
  const tasks = [dsTask, ecsTask];
  const roadmaps = [academicRoadmap, gslRoadmap];

  // Specific domain checks
  assert.equal(calculateGoalPlannedMinutesInPlan(academicGoal.id, roadmaps, tasks, unifiedPlan), 90);
  assert.equal(calculateGoalPlannedMinutesInPlan(gslGoal.id, roadmaps, tasks, unifiedPlan), 120);

  // Summary
  const summary = calculateWeeklyProgressSummary(unifiedPlan, sessions, tasks);
  assert.equal(summary.plannedMinutes, 210);
  assert.equal(summary.actualMinutes, 150);
  assert.equal(summary.varianceMinutes, -60);
  assert.equal(summary.remainingMinutes, 60);

  assert.equal(summary.taskSummaries.length, 2);
  const dsSummary = summary.taskSummaries.find((s) => s.taskId === dsTask.id);
  const ecsSummary = summary.taskSummaries.find((s) => s.taskId === ecsTask.id);

  assert.equal(dsSummary?.actualMinutes, 90);
  assert.equal(dsSummary?.percentage, 100);

  assert.equal(ecsSummary?.actualMinutes, 60);
  assert.equal(ecsSummary?.percentage, 50);

  await db.close();
});
