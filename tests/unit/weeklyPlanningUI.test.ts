/**
 * Phase 10A Tests: Weekly Planning UI & Application Flow
 *
 * Exhaustive coverage for:
 * 1. Pure helper utilities:
 *    - ISO week navigation (Previous / Current / Next, boundary handling)
 *    - 7 days-in-week generator (Mon-Sun, valid ISO dates matching week)
 *    - Week range formatting with Gregorian & Persian calendars in English & Persian
 *    - Week heading formatting with localized digits and labels
 *    - Summary derivation (total minutes, item counts, task completion)
 * 2. Weekly Planning UI Application Flows:
 *    - Loading selected week with no prior plan (Empty week state)
 *    - Creating weekly plan item for a new week (Plan initialization + item addition)
 *    - Adding items to an existing weekly plan
 *    - Validating planned minutes (rejecting negative numbers)
 *    - Validating target date (rejecting date outside selected week)
 *    - Editing planned minutes on an existing item
 *    - Editing target date on an existing item
 *    - Toggling completion status on a plan item
 *    - Removing an item from the weekly plan
 *    - Graceful fallback for deleted/missing tasks
 *    - Refreshing / reloading from persistence and verifying exact state
 * 3. Calendar & Language Preference presentation compatibility
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import {
  generateEntityId,
  createTimestamp,
  getWeekIdentifier,
  getWeekDateRange,
  isDateInWeek,
  isValidWeekIdentifier,
  createGoal,
  createRoadmap,
  createTask,
  WeeklyPlan,
  WeeklyPlanItem,
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
import { createApplicationServices, ApplicationServices } from '../../src/application';
import { ValidationError } from '../../src/application/errors';

import {
  getCurrentWeekIdentifier,
  getPreviousWeekIdentifier,
  getNextWeekIdentifier,
  getDaysInWeek,
  formatWeekRange,
  formatWeekHeading,
  deriveWeeklyOverviewSummary,
} from '../../src/features/weekly-plans/weeklyPlanHelpers';

import {
  UserPreferences,
  DEFAULT_PREFERENCES,
  formatDate,
  formatNumeral,
  formatDurationHoursMinutes,
} from '../../src/app/preferences';

function setupTestEnvironment() {
  const dbName = `pathflow-weekly-ui-test-${generateEntityId()}`;
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
// 1. Pure Helper Utilities Tests
// =============================================================================

test('WeeklyPlanHelpers: Week navigation calculates previous, next, and current week correctly', () => {
  const currentWeek = getCurrentWeekIdentifier();
  assert.match(currentWeek, /^\d{4}-W\d{2}$/);

  // Standard week: 2026-W38
  assert.equal(getPreviousWeekIdentifier('2026-W38'), '2026-W37');
  assert.equal(getNextWeekIdentifier('2026-W38'), '2026-W39');

  // Year boundary: 2026-W01 -> previous is 2025-W52 or 2025-W53
  const prevOfW01 = getPreviousWeekIdentifier('2026-W01');
  assert.match(prevOfW01, /^2025-W5[23]$/);

  // Year boundary: 2026-W52 -> next is 2026-W53 or 2027-W01
  const nextOfW52 = getNextWeekIdentifier('2026-W52');
  assert.ok(nextOfW52 === '2026-W53' || nextOfW52 === '2027-W01');

  // Invalid week identifier throws
  assert.throws(() => getPreviousWeekIdentifier('invalid-week'), /Invalid week identifier/);
  assert.throws(() => getNextWeekIdentifier('2026-99'), /Invalid week identifier/);
});

test('WeeklyPlanHelpers: getDaysInWeek generates exactly 7 days matching the ISO week', () => {
  const days = getDaysInWeek('2026-W38');
  assert.equal(days.length, 7);

  // Monday to Sunday (dayOfWeek 1 to 7)
  days.forEach((day, index) => {
    assert.equal(day.dayOfWeek, index + 1);
    assert.match(day.dateIso, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(
      isDateInWeek(day.dateIso, '2026-W38'),
      `Day ${day.dateIso} must fall within 2026-W38`
    );
  });

  // Monday should be 2026-09-14 and Sunday should be 2026-09-20
  assert.equal(days[0].dateIso, '2026-09-14');
  assert.equal(days[6].dateIso, '2026-09-20');

  // Invalid week returns empty array
  assert.deepEqual(getDaysInWeek('invalid'), []);
});

test('WeeklyPlanHelpers: formatWeekRange formats correctly across language and calendar preferences', () => {
  const enGregorian: UserPreferences = { language: 'en', calendar: 'gregorian' };
  const enPersian: UserPreferences = { language: 'en', calendar: 'persian' };
  const faGregorian: UserPreferences = { language: 'fa', calendar: 'gregorian' };
  const faPersian: UserPreferences = { language: 'fa', calendar: 'persian' };

  const week = '2026-W38'; // Sep 14 to Sep 20, 2026

  const rangeEnGreg = formatWeekRange(week, enGregorian);
  assert.match(rangeEnGreg, /Sep 14/);
  assert.match(rangeEnGreg, /Sep 20, 2026/);

  const rangeEnPersian = formatWeekRange(week, enPersian);
  assert.ok(rangeEnPersian.includes('1405') || rangeEnPersian.includes('Mehr') || rangeEnPersian.includes('Shahrivar'));

  const rangeFaGreg = formatWeekRange(week, faGregorian);
  assert.ok(rangeFaGreg.includes('تا'));

  const rangeFaPersian = formatWeekRange(week, faPersian);
  assert.ok(rangeFaPersian.includes('تا'));
  assert.ok(rangeFaPersian.includes('۱۴۰۵') || rangeFaPersian.includes('مهر') || rangeFaPersian.includes('شهریور'));
});

test('WeeklyPlanHelpers: formatWeekHeading localizes labels and digits', () => {
  const enPrefs: UserPreferences = { language: 'en', calendar: 'gregorian' };
  const faPrefs: UserPreferences = { language: 'fa', calendar: 'persian' };

  const headingEn = formatWeekHeading('2026-W38', enPrefs);
  assert.equal(headingEn.main, 'Week 38, 2026');
  assert.equal(headingEn.raw, '2026-W38');

  const headingFa = formatWeekHeading('2026-W38', faPrefs);
  assert.ok(headingFa.main.includes('هفته'));
  assert.ok(headingFa.main.includes('۳۸'));
  assert.ok(headingFa.raw.includes('۲۰۲۶'));
});

test('WeeklyPlanHelpers: deriveWeeklyOverviewSummary calculates totals and task completion accurately', () => {
  // Null plan
  const nullSummary = deriveWeeklyOverviewSummary(null);
  assert.equal(nullSummary.totalPlannedMinutes, 0);
  assert.equal(nullSummary.itemCount, 0);
  assert.equal(nullSummary.completedItemCount, 0);
  assert.equal(nullSummary.taskCompletionPercentage, 0);

  // Plan with items
  const taskId1 = generateEntityId();
  const taskId2 = generateEntityId();
  const mockPlan: WeeklyPlan = {
    id: generateEntityId(),
    weekIdentifier: '2026-W38',
    title: 'Test Plan',
    targetMinutes: 300,
    items: [
      {
        id: generateEntityId(),
        weeklyPlanId: generateEntityId(),
        taskId: taskId1,
        plannedMinutes: 120,
        isCompleted: true,
      },
      {
        id: generateEntityId(),
        weeklyPlanId: generateEntityId(),
        taskId: taskId2,
        targetDate: '2026-09-22',
        plannedMinutes: 60,
        isCompleted: false,
      },
    ],
    createdAt: createTimestamp(),
    updatedAt: createTimestamp(),
  };

  const summary = deriveWeeklyOverviewSummary(mockPlan);
  assert.equal(summary.totalPlannedMinutes, 180);
  assert.equal(summary.itemCount, 2);
  assert.equal(summary.completedItemCount, 1);
  assert.equal(summary.plannedTaskCount, 2);
});

// =============================================================================
// 2. Application Service Integration & UI Flow Tests
// =============================================================================

test('Weekly Planning Flow: Loading a week with no prior plan returns null (Empty Week state)', async () => {
  const { app } = setupTestEnvironment();
  const week = '2026-W38';

  const plan = await app.weeklyPlans.getWeeklyPlanByWeek(week);
  assert.equal(plan, null);
});

test('Weekly Planning Flow: Creating first weekly plan item initializes the plan aggregate', async () => {
  const { app, repos } = setupTestEnvironment();

  // Create Goal, Roadmap, and Task
  const goal = await repos.goals.create(createGoal({ title: 'Academic Excellence' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Math Analysis' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Calculus Exercises', estimatedMinutes: 90 })
  );

  const week = '2026-W38';

  // UI flow: no plan exists yet -> calls createWeeklyPlan with item
  const createdPlan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [
      {
        taskId: task.id,
        plannedMinutes: 90,
        targetDate: '2026-09-14',
      },
    ],
  });

  assert.equal(createdPlan.weekIdentifier, week);
  assert.equal(createdPlan.items.length, 1);
  assert.equal(createdPlan.items[0].taskId, task.id);
  assert.equal(createdPlan.items[0].plannedMinutes, 90);
  assert.equal(createdPlan.items[0].targetDate, '2026-09-14');
  assert.equal(createdPlan.items[0].isCompleted, false);

  // Verify persistence: Querying again returns the created plan
  const fetchedPlan = await app.weeklyPlans.getWeeklyPlanByWeek(week);
  assert.ok(fetchedPlan);
  assert.equal(fetchedPlan.id, createdPlan.id);
  assert.equal(fetchedPlan.items.length, 1);
});

test('Weekly Planning Flow: Adding item to an existing plan appends to items list', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'Game Development' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Physics Engine' })
  );
  const task1 = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Collision Detection' })
  );
  const task2 = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Rigid Body Solver' })
  );

  const week = '2026-W38';
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [{ taskId: task1.id, plannedMinutes: 60 }],
  });

  // Add second item
  const updatedPlan = await app.weeklyPlans.addWeeklyPlanItem(plan.id, {
    taskId: task2.id,
    plannedMinutes: 120,
    targetDate: '2026-09-16',
  });

  assert.equal(updatedPlan.items.length, 2);
  assert.equal(updatedPlan.items[1].taskId, task2.id);
  assert.equal(updatedPlan.items[1].plannedMinutes, 120);
  assert.equal(updatedPlan.items[1].targetDate, '2026-09-16');

  // Verify database persistence
  const reloaded = await app.weeklyPlans.getWeeklyPlanByWeek(week);
  assert.ok(reloaded);
  assert.equal(reloaded.items.length, 2);
});

test('Weekly Planning Flow: Rejects negative planned minutes with ValidationError', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'Goal 1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Roadmap 1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 1' })
  );

  const week = '2026-W38';
  const plan = await app.weeklyPlans.createWeeklyPlan({ weekIdentifier: week });

  await assert.rejects(
    async () => {
      await app.weeklyPlans.addWeeklyPlanItem(plan.id, {
        taskId: task.id,
        plannedMinutes: -30,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.match((err as ValidationError).message, /non-negative/);
      return true;
    }
  );
});

test('Weekly Planning Flow: Rejects target date outside selected week with ValidationError', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'Goal 1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Roadmap 1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 1' })
  );

  const week = '2026-W38'; // 2026-09-21 to 2026-09-27
  const plan = await app.weeklyPlans.createWeeklyPlan({ weekIdentifier: week });

  // 2026-09-28 is Monday of W39, outside W38
  await assert.rejects(
    async () => {
      await app.weeklyPlans.addWeeklyPlanItem(plan.id, {
        taskId: task.id,
        plannedMinutes: 60,
        targetDate: '2026-09-28',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.match((err as ValidationError).message, /does not fall within week "2026-W38"/);
      return true;
    }
  );
});

test('Weekly Planning Flow: Editing planned minutes on an existing item', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'Goal 1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Roadmap 1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 1' })
  );

  const week = '2026-W38';
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [{ taskId: task.id, plannedMinutes: 60 }],
  });

  const itemId = plan.items[0].id;

  // Edit planned minutes from 60 to 150
  const updatedPlan = await app.weeklyPlans.updateWeeklyPlanItem(plan.id, itemId, {
    plannedMinutes: 150,
  });

  assert.equal(updatedPlan.items[0].plannedMinutes, 150);

  // Verify persistence
  const reloaded = await app.weeklyPlans.getWeeklyPlanByWeek(week);
  assert.ok(reloaded);
  assert.equal(reloaded.items[0].plannedMinutes, 150);
});

test('Weekly Planning Flow: Editing target date on an existing item', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'Goal 1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Roadmap 1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 1' })
  );

  const week = '2026-W38';
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [{ taskId: task.id, plannedMinutes: 60, targetDate: '2026-09-14' }],
  });

  const itemId = plan.items[0].id;

  // Update target date to 2026-09-18
  const updatedPlan = await app.weeklyPlans.updateWeeklyPlanItem(plan.id, itemId, {
    targetDate: '2026-09-18',
  });

  assert.equal(updatedPlan.items[0].targetDate, '2026-09-18');

  // Verify persistence
  const reloaded = await app.weeklyPlans.getWeeklyPlanByWeek(week);
  assert.ok(reloaded);
  assert.equal(reloaded.items[0].targetDate, '2026-09-18');
});

test('Weekly Planning Flow: Toggling completion status on a plan item', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'Goal 1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Roadmap 1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 1' })
  );

  const week = '2026-W38';
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [{ taskId: task.id, plannedMinutes: 60 }],
  });

  const itemId = plan.items[0].id;
  assert.equal(plan.items[0].isCompleted, false);

  // Toggle to completed
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

test('Weekly Planning Flow: Removing an item from weekly plan', async () => {
  const { app, repos } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'Goal 1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Roadmap 1' })
  );
  const task1 = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 1' })
  );
  const task2 = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Task 2' })
  );

  const week = '2026-W38';
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [
      { taskId: task1.id, plannedMinutes: 45 },
      { taskId: task2.id, plannedMinutes: 90 },
    ],
  });

  assert.equal(plan.items.length, 2);

  // Remove first item
  const updatedPlan = await app.weeklyPlans.removeWeeklyPlanItem(plan.id, plan.items[0].id);

  assert.equal(updatedPlan.items.length, 1);
  assert.equal(updatedPlan.items[0].taskId, task2.id);

  // Verify persistence
  const reloaded = await app.weeklyPlans.getWeeklyPlanByWeek(week);
  assert.ok(reloaded);
  assert.equal(reloaded.items.length, 1);
  assert.equal(reloaded.items[0].taskId, task2.id);
});

test('Weekly Planning Flow: Graceful handling when a task is deleted', async () => {
  const { app, repos, db } = setupTestEnvironment();

  const goal = await repos.goals.create(createGoal({ title: 'Goal 1' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Roadmap 1' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Temporary Task' })
  );

  const week = '2026-W38';
  const plan = await app.weeklyPlans.createWeeklyPlan({
    weekIdentifier: week,
    items: [{ taskId: task.id, plannedMinutes: 60 }],
  });

  assert.equal(plan.items.length, 1);

  // Delete task directly from Dexie table to simulate external / orphaned task
  await db.tasks.delete(task.id);

  // Load weekly plan again
  const reloadedPlan = await app.weeklyPlans.getWeeklyPlanByWeek(week);
  assert.ok(reloadedPlan);
  assert.equal(reloadedPlan.items.length, 1);

  // In the UI, tasksMap.get(item.taskId) will return undefined.
  // Verify helper calculations handle missing task without throwing
  const summary = deriveWeeklyOverviewSummary(reloadedPlan, []);
  assert.equal(summary.totalPlannedMinutes, 60);
  assert.equal(summary.itemCount, 1);
});

test('Weekly Planning Presentation: Duration and numeral presentation honors Persian and Gregorian preferences', () => {
  const enPrefs: UserPreferences = { language: 'en', calendar: 'gregorian' };
  const faPrefs: UserPreferences = { language: 'fa', calendar: 'persian' };

  // Formatted duration in English vs Persian
  const durEn = formatDurationHoursMinutes(90, enPrefs);
  assert.equal(durEn, '1h 30m');

  const durFa = formatDurationHoursMinutes(90, faPrefs);
  assert.ok(durFa.includes('۱ ساعت'));
  assert.ok(durFa.includes('۳۰ دقیقه'));

  // Formatted date in Persian
  const dateFa = formatDate('2026-09-21', faPrefs, { month: 'long', day: 'numeric' });
  assert.ok(dateFa.includes('۳۰') || dateFa.includes('شهریور') || dateFa.includes('مهر'));

  // Formatted numeral in Persian
  assert.equal(formatNumeral(2026, faPrefs), '۲۰۲۶');
  assert.equal(formatNumeral(38, faPrefs), '۳۸');
});
