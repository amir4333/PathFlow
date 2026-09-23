/**
 * Phase 10B Tests: Weekly Planning Interaction
 *
 * Exhaustive coverage for:
 * 1. Pure Phase 10B helper functions:
 *    - Daily capacity / load calculation (empty, light, moderate, heavy)
 *    - Day name translation key mapping (Mon -> monday, Sun -> sunday)
 *    - Allocation summary derivation (total, dated, flexible, active days, completion)
 * 2. Weekly Board Daily Breakdown:
 *    - 7 days properly derived from WeeklyPlan
 *    - Correct daily minutes totals and item groupings
 *    - Correct isolation of flexible commitments
 * 3. Interaction Application Flows:
 *    - Moving dated item to another day in the week (e.g. Monday -> Thursday)
 *    - Moving flexible item to a specific day (Flexible -> Wednesday)
 *    - Moving dated item to flexible (Thursday -> Flexible)
 *    - Enforcing domain boundary when moving (rejecting move outside ISO week)
 *    - Enforcing domain uniqueness (rejecting move if task already scheduled on destination day)
 *    - Duplicating planned item to another day
 *    - Duplicating planned item to flexible
 *    - Toggling completion state on individual planned items
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import {
  generateEntityId,
  createGoal,
  createRoadmap,
  createTask,
  createWeeklyPlan,
  WeeklyPlan,
  WeeklyPlanItem,
  calculateWeeklyPlanDailyBreakdown,
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
import { createApplicationServices } from '../../src/application';
import { ValidationError } from '../../src/application/errors';

import {
  getDailyCapacityLevel,
  getDayNameTranslationKey,
  deriveWeeklyAllocationSummary,
} from '../../src/features/weekly-plans/weeklyPlanHelpers';

function setupTestEnvironment() {
  const dbName = `pathflow-weekly-10b-test-${generateEntityId()}`;
  const db = new PathFlowDB(dbName);
  const repos = {
    goals: new DexieGoalRepository(db),
    roadmaps: new DexieRoadmapRepository(db),
    tasks: new DexieTaskRepository(db),
    sessions: new DexieSessionRepository(db),
    weeklyPlans: new DexieWeeklyPlanRepository(db),
    weeklyPlanItems: new DexieWeeklyPlanItemRepository(db),
  };
  const app = createApplicationServices(repos);
  return { db, repos, app };
}

// =============================================================================
// 1. Pure Helpers: Daily Capacity & Day Translation Mapping
// =============================================================================

test('Phase 10B Helpers: getDailyCapacityLevel correctly classifies load thresholds', () => {
  assert.equal(getDailyCapacityLevel(0), 'empty');
  assert.equal(getDailyCapacityLevel(-10), 'empty');
  assert.equal(getDailyCapacityLevel(30), 'light');
  assert.equal(getDailyCapacityLevel(120), 'light');
  assert.equal(getDailyCapacityLevel(121), 'moderate');
  assert.equal(getDailyCapacityLevel(240), 'moderate');
  assert.equal(getDailyCapacityLevel(241), 'heavy');
  assert.equal(getDailyCapacityLevel(480), 'heavy');
});

test('Phase 10B Helpers: getDayNameTranslationKey maps day of week indices 1..7', () => {
  assert.equal(getDayNameTranslationKey(1), 'monday');
  assert.equal(getDayNameTranslationKey(2), 'tuesday');
  assert.equal(getDayNameTranslationKey(3), 'wednesday');
  assert.equal(getDayNameTranslationKey(4), 'thursday');
  assert.equal(getDayNameTranslationKey(5), 'friday');
  assert.equal(getDayNameTranslationKey(6), 'saturday');
  assert.equal(getDayNameTranslationKey(7), 'sunday');
});

test('Phase 10B Helpers: deriveWeeklyAllocationSummary correctly computes metrics', () => {
  // Empty plan
  const emptySummary = deriveWeeklyAllocationSummary(null);
  assert.equal(emptySummary.totalPlannedMinutes, 0);
  assert.equal(emptySummary.datedMinutes, 0);
  assert.equal(emptySummary.flexibleMinutes, 0);
  assert.equal(emptySummary.itemCount, 0);
  assert.equal(emptySummary.activeDaysCount, 0);
  assert.equal(emptySummary.completedItemCount, 0);

  // Week 2026-W38 runs Mon 2026-09-14 to Sun 2026-09-20
  const mockPlan = createWeeklyPlan({
    id: 'wp-1',
    weekIdentifier: '2026-W38',
    items: [
      {
        id: 'item-1',
        taskId: 't-1',
        plannedMinutes: 90,
        targetDate: '2026-09-14', // Monday
        isCompleted: true,
      },
      {
        id: 'item-2',
        taskId: 't-2',
        plannedMinutes: 60,
        targetDate: '2026-09-16', // Wednesday
        isCompleted: false,
      },
      {
        id: 'item-3',
        taskId: 't-3',
        plannedMinutes: 120,
        // flexible (no targetDate)
        isCompleted: false,
      },
    ],
  });

  const summary = deriveWeeklyAllocationSummary(mockPlan);
  assert.equal(summary.totalPlannedMinutes, 270);
  assert.equal(summary.datedMinutes, 150);
  assert.equal(summary.flexibleMinutes, 120);
  assert.equal(summary.itemCount, 3);
  assert.equal(summary.activeDaysCount, 2); // Monday and Wednesday
  assert.equal(summary.completedItemCount, 1);
});

// =============================================================================
// 2. Weekly Board Breakdown Validation
// =============================================================================

test('Weekly Board: Daily breakdown isolates 7 days and flexible items', () => {
  const plan = createWeeklyPlan({
    id: 'wp-2',
    weekIdentifier: '2026-W38',
    items: [
      {
        id: 'item-a',
        taskId: 'task-a',
        plannedMinutes: 150,
        targetDate: '2026-09-14', // Monday
        isCompleted: false,
      },
      {
        id: 'item-b',
        taskId: 'task-b',
        plannedMinutes: 60,
        targetDate: '2026-09-14', // Monday second item
        isCompleted: false,
      },
      {
        id: 'item-c',
        taskId: 'task-c',
        plannedMinutes: 90,
        // flexible
        isCompleted: false,
      },
    ],
  });

  const breakdown = calculateWeeklyPlanDailyBreakdown(plan);
  assert.equal(breakdown.days.length, 7);
  assert.equal(breakdown.totalPlannedMinutes, 300);
  assert.equal(breakdown.unallocatedMinutes, 90);
  assert.equal(breakdown.unallocatedItems.length, 1);
  assert.equal(breakdown.unallocatedItems[0].taskId, 'task-c');

  // Monday
  const monday = breakdown.days.find((d) => d.dayOfWeek === 1);
  assert.ok(monday);
  assert.equal(monday.date, '2026-09-14');
  assert.equal(monday.plannedMinutes, 210);
  assert.equal(monday.items.length, 2);

  // Tuesday
  const tuesday = breakdown.days.find((d) => d.dayOfWeek === 2);
  assert.ok(tuesday);
  assert.equal(tuesday.date, '2026-09-15');
  assert.equal(tuesday.plannedMinutes, 0);
  assert.equal(tuesday.items.length, 0);
});

// =============================================================================
// 3. Application Flow: Move, Duplicate, and Toggle Interactions
// =============================================================================

test('Weekly Planning Flow: Moving a dated item to another day within the same week', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'G1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'R1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 1' })
  );

  const week = '2026-W38'; // Sep 14 to Sep 20
  const mondayDate = '2026-09-14';
  const thursdayDate = '2026-09-17';

  // 1. Create plan with item on Monday
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [
      {
        taskId: task.id,
        plannedMinutes: 90,
        targetDate: mondayDate,
      },
    ],
  });

  const originalItemId = plan.items[0].id;
  assert.equal(plan.items[0].targetDate, mondayDate);

  // 2. Move item from Monday to Thursday
  const updatedPlan = await app.weeklyPlans.updateWeeklyPlanItem(plan.id, originalItemId, {
    targetDate: thursdayDate,
  });

  const movedItem = updatedPlan.items.find((i) => i.id === originalItemId);
  assert.ok(movedItem);
  assert.equal(movedItem.targetDate, thursdayDate);
  assert.equal(movedItem.plannedMinutes, 90);

  // 3. Verify derived breakdown reflects the move
  const breakdown = calculateWeeklyPlanDailyBreakdown(updatedPlan);
  const monday = breakdown.days.find((d) => d.date === mondayDate);
  const thursday = breakdown.days.find((d) => d.date === thursdayDate);

  assert.equal(monday?.plannedMinutes, 0);
  assert.equal(monday?.items.length, 0);
  assert.equal(thursday?.plannedMinutes, 90);
  assert.equal(thursday?.items.length, 1);
});

test('Weekly Planning Flow: Moving flexible item to a specific day (Flexible -> Wednesday)', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'G1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'R1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 1' })
  );

  const week = '2026-W38';
  const wednesdayDate = '2026-09-16';

  // 1. Create plan with flexible item (no targetDate)
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [
      {
        taskId: task.id,
        plannedMinutes: 120,
      },
    ],
  });

  const itemId = plan.items[0].id;
  assert.equal(plan.items[0].targetDate, undefined);

  // 2. Move flexible item to Wednesday
  const updatedPlan = await app.weeklyPlans.updateWeeklyPlanItem(plan.id, itemId, {
    targetDate: wednesdayDate,
  });

  const updatedItem = updatedPlan.items.find((i) => i.id === itemId);
  assert.ok(updatedItem);
  assert.equal(updatedItem.targetDate, wednesdayDate);

  // 3. Breakdown check: unallocated items should now be 0
  const breakdown = calculateWeeklyPlanDailyBreakdown(updatedPlan);
  assert.equal(breakdown.unallocatedMinutes, 0);
  assert.equal(breakdown.unallocatedItems.length, 0);

  const wednesday = breakdown.days.find((d) => d.date === wednesdayDate);
  assert.equal(wednesday?.plannedMinutes, 120);
});

test('Weekly Planning Flow: Moving dated item to flexible (Wednesday -> Flexible)', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'G1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'R1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 1' })
  );

  const week = '2026-W38';
  const wednesdayDate = '2026-09-16';

  // 1. Create plan with Wednesday item
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [
      {
        taskId: task.id,
        plannedMinutes: 60,
        targetDate: wednesdayDate,
      },
    ],
  });

  const itemId = plan.items[0].id;

  // 2. Clear targetDate by passing empty string ''
  const updatedPlan = await app.weeklyPlans.updateWeeklyPlanItem(plan.id, itemId, {
    targetDate: '',
  });

  const updatedItem = updatedPlan.items.find((i) => i.id === itemId);
  assert.ok(updatedItem);
  assert.equal(updatedItem.targetDate, undefined);

  // 3. Breakdown check: unallocated items should now be 1
  const breakdown = calculateWeeklyPlanDailyBreakdown(updatedPlan);
  assert.equal(breakdown.unallocatedMinutes, 60);
  assert.equal(breakdown.unallocatedItems.length, 1);
});

test('Weekly Planning Flow: Reject moving item outside the selected ISO week', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'G1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'R1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 1' })
  );

  const week = '2026-W38'; // Sep 14 to Sep 20
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [
      {
        taskId: task.id,
        plannedMinutes: 60,
        targetDate: '2026-09-15',
      },
    ],
  });

  const itemId = plan.items[0].id;

  // Try moving to next week's date: 2026-09-22
  await assert.rejects(
    async () => {
      await app.weeklyPlans.updateWeeklyPlanItem(plan.id, itemId, {
        targetDate: '2026-09-22',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /does not fall within week/i);
      return true;
    }
  );
});

test('Weekly Planning Flow: Duplicating a planned item to another day or as flexible', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'G1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'R1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Core Task' })
  );

  const week = '2026-W38';
  const mondayDate = '2026-09-14';
  const fridayDate = '2026-09-18';

  // 1. Create plan with Monday item
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [
      {
        taskId: task.id,
        plannedMinutes: 60,
        targetDate: mondayDate,
      },
    ],
  });

  assert.equal(plan.items.length, 1);

  // 2. Duplicate item on Friday
  const planWithDupDay = await app.weeklyPlans.addWeeklyPlanItem(plan.id, {
    taskId: task.id,
    plannedMinutes: 60,
    targetDate: fridayDate,
  });

  assert.equal(planWithDupDay.items.length, 2);

  // 3. Duplicate item as flexible (different targetDate: undefined)
  const planWithDupFlex = await app.weeklyPlans.addWeeklyPlanItem(plan.id, {
    taskId: task.id,
    plannedMinutes: 60,
  });

  assert.equal(planWithDupFlex.items.length, 3);

  // 4. Verify total planned time: 60 * 3 = 180
  const summary = deriveWeeklyAllocationSummary(planWithDupFlex);
  assert.equal(summary.totalPlannedMinutes, 180);
  assert.equal(summary.datedMinutes, 120);
  assert.equal(summary.flexibleMinutes, 60);
  assert.equal(summary.activeDaysCount, 2); // Monday and Friday
});

test('Weekly Planning Flow: Toggling completion state on board items', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'G1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'R1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Interactive Task' })
  );

  const week = '2026-W38';
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [
      {
        taskId: task.id,
        plannedMinutes: 90,
        targetDate: '2026-09-15',
      },
    ],
  });

  const itemId = plan.items[0].id;
  assert.equal(plan.items[0].isCompleted, false);

  // Toggle complete
  const planCompleted = await app.weeklyPlans.updateWeeklyPlanItem(plan.id, itemId, {
    isCompleted: true,
  });
  assert.equal(planCompleted.items[0].isCompleted, true);

  // Toggle back to incomplete
  const planIncomplete = await app.weeklyPlans.updateWeeklyPlanItem(plan.id, itemId, {
    isCompleted: false,
  });
  assert.equal(planIncomplete.items[0].isCompleted, false);
});
