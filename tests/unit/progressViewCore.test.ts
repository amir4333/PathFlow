/**
 * Phase 11A: Progress & Review Core Unit Tests
 *
 * Verifies calculation, aggregation, and application service integration
 * for Progress & Review:
 * - Period selection: This Week, Last Week, Custom Range
 * - Overall progress summary (Planned vs Actual, Commitments, Tasks)
 * - Goal & Roadmap progress derivation
 * - Task Activity deduplication and metric tracking
 * - Daily Review 7-day breakdown
 * - Invariant enforcement and empty state resilience
 */

import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createGoal,
  createRoadmap,
  createTask,
  createSession,
  createWeeklyPlan,
  createWeeklyPlanItem,
  getWeekIdentifier,
  getThisWeekPeriod,
  getPreviousWeekPeriod,
  calculateComprehensivePeriodReview,
  isValidDateRange,
} from '../../src/domain';

import { createApplicationServices, ValidationError } from '../../src/application';
import { createLocalRepositories } from '../../src/data/repositories/local';
import { TRANSLATIONS, getTranslation } from '../../src/app/preferences/translations';

// -----------------------------------------------------------------------------
// Test Helpers & Mock Fixtures
// -----------------------------------------------------------------------------

function setupTestFixtures() {
  const goal1 = createGoal({
    title: 'Master TypeScript & Distributed Systems',
    description: 'Core engineering goals',
  });

  const roadmap1 = createRoadmap({
    goalId: goal1.id,
    title: 'Compiler Architecture',
  });

  const roadmap2 = createRoadmap({
    goalId: goal1.id,
    title: 'Distributed Consensus',
  });

  const task1 = createTask({
    roadmapId: roadmap1.id,
    title: 'AST Parser Implementation',
    estimatedMinutes: 180,
  });

  const task2 = createTask({
    roadmapId: roadmap1.id,
    title: 'Type Checker Pass',
    estimatedMinutes: 120,
  });

  const task3 = createTask({
    roadmapId: roadmap2.id,
    title: 'Raft Leader Election',
    estimatedMinutes: 240,
  });

  return { goal1, roadmap1, roadmap2, task1, task2, task3 };
}

// -----------------------------------------------------------------------------
// 1. Domain Calculations: Comprehensive Period Review
// -----------------------------------------------------------------------------

test('Progress Review Domain: Calculates This Week summary accurately', () => {
  const { goal1, roadmap1, roadmap2, task1, task2, task3 } = setupTestFixtures();

  // Let reference week be 2026-W39 (Monday 2026-09-21 to Sunday 2026-09-27)
  const weekId = '2026-W39';
  const plan = createWeeklyPlan({
    weekIdentifier: weekId,
    items: [
      createWeeklyPlanItem({
        taskId: task1.id,
        plannedMinutes: 120,
        targetDate: '2026-09-21',
        isCompleted: true,
      }),
      createWeeklyPlanItem({
        taskId: task2.id,
        plannedMinutes: 60,
        targetDate: '2026-09-22',
        isCompleted: false,
      }),
      createWeeklyPlanItem({
        taskId: task3.id,
        plannedMinutes: 90, // flexible commitment
        isCompleted: false,
      }),
    ],
  });

  // Sessions in this week
  const s1 = createSession({
    taskId: task1.id,
    durationMinutes: 90,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T11:30:00.000Z',
  });
  const s2 = createSession({
    taskId: task1.id,
    durationMinutes: 45,
    startedAt: '2026-09-21T14:00:00.000Z',
    endedAt: '2026-09-21T14:45:00.000Z',
  });
  const s3 = createSession({
    taskId: task2.id,
    durationMinutes: 60,
    startedAt: '2026-09-22T09:00:00.000Z',
    endedAt: '2026-09-22T10:00:00.000Z',
  });

  // Session outside this week (should not be counted)
  const sOutside = createSession({
    taskId: task1.id,
    durationMinutes: 120,
    startedAt: '2026-09-15T10:00:00.000Z',
    endedAt: '2026-09-15T12:00:00.000Z',
  });

  const period = {
    type: 'this-week' as const,
    startDate: '2026-09-21',
    endDate: '2026-09-27',
    weekIdentifier: weekId,
    label: `This Week (${weekId})`,
  };

  const review = calculateComprehensivePeriodReview({
    period,
    sessions: [s1, s2, s3, sOutside],
    tasks: [task1, task2, task3],
    roadmaps: [roadmap1, roadmap2],
    goals: [goal1],
    weeklyPlans: [plan],
  });

  // Summary checks
  // Total planned = 120 + 60 + 90 = 270 minutes
  assert.equal(review.summary.totalPlannedMinutes, 270);
  // Total actual = 90 + 45 + 60 = 195 minutes (sOutside ignored)
  assert.equal(review.summary.totalActualMinutes, 195);
  // Variance = actual - planned = 195 - 270 = -75 minutes
  assert.equal(review.summary.varianceMinutes, -75);
  // Commitments = 3 planned, 1 completed
  assert.equal(review.summary.plannedCommitmentsCount, 3);
  assert.equal(review.summary.completedCommitmentsCount, 1);
  // Tasks worked on = 2 (task1, task2)
  assert.equal(review.summary.tasksWorkedOnCount, 2);

  // Goal Progress
  assert.equal(review.goals.length, 1);
  assert.equal(review.goals[0].goalId, goal1.id);
  assert.equal(review.goals[0].actualMinutes, 195);
  assert.equal(review.goals[0].plannedMinutes, 270);
  assert.equal(review.goals[0].hasActivityInPeriod, true);

  // Roadmap Progress
  assert.equal(review.roadmaps.length, 2);
  const r1Review = review.roadmaps.find((r) => r.roadmapId === roadmap1.id)!;
  assert.equal(r1Review.actualMinutes, 195);
  assert.equal(r1Review.plannedMinutes, 180);
  assert.equal(r1Review.hasActivityInPeriod, true);

  const r2Review = review.roadmaps.find((r) => r.roadmapId === roadmap2.id)!;
  assert.equal(r2Review.actualMinutes, 0);
  assert.equal(r2Review.plannedMinutes, 90);
  assert.equal(r2Review.hasActivityInPeriod, true);

  // Task Activity (deduplicated by task)
  assert.equal(review.tasks.length, 3);
  const t1Act = review.tasks.find((t) => t.taskId === task1.id)!;
  assert.equal(t1Act.actualMinutes, 135);
  assert.equal(t1Act.sessionCount, 2);
  assert.equal(t1Act.plannedMinutes, 120);

  // Daily Breakdown: exactly 7 days
  assert.equal(review.dailyBreakdown.length, 7);
  const monday = review.dailyBreakdown[0];
  assert.equal(monday.date, '2026-09-21');
  assert.equal(monday.dayOfWeek, 1);
  assert.equal(monday.actualMinutes, 135);
  assert.equal(monday.plannedMinutes, 120);
  assert.equal(monday.sessionCount, 2);

  const tuesday = review.dailyBreakdown[1];
  assert.equal(tuesday.date, '2026-09-22');
  assert.equal(tuesday.dayOfWeek, 2);
  assert.equal(tuesday.actualMinutes, 60);
  assert.equal(tuesday.plannedMinutes, 60);
  assert.equal(tuesday.sessionCount, 1);
});

test('Progress Review Domain: Custom range isolates dates strictly', () => {
  const { goal1, roadmap1, roadmap2, task1, task2, task3 } = setupTestFixtures();

  // Sessions spanning across several days
  const s1 = createSession({
    taskId: task1.id,
    durationMinutes: 60,
    startedAt: '2026-09-10T10:00:00.000Z',
    endedAt: '2026-09-10T11:00:00.000Z',
  });
  const s2 = createSession({
    taskId: task2.id,
    durationMinutes: 90,
    startedAt: '2026-09-12T10:00:00.000Z',
    endedAt: '2026-09-12T11:30:00.000Z',
  });
  const s3 = createSession({
    taskId: task3.id,
    durationMinutes: 30,
    startedAt: '2026-09-15T10:00:00.000Z',
    endedAt: '2026-09-15T10:30:00.000Z',
  });

  // Custom range from 2026-09-10 to 2026-09-12 (3 days)
  const period = {
    type: 'custom' as const,
    startDate: '2026-09-10',
    endDate: '2026-09-12',
    label: 'Custom Range',
  };

  const review = calculateComprehensivePeriodReview({
    period,
    sessions: [s1, s2, s3],
    tasks: [task1, task2, task3],
    roadmaps: [roadmap1, roadmap2],
    goals: [goal1],
    weeklyPlans: [],
  });

  assert.equal(review.summary.totalActualMinutes, 150); // s1 (60) + s2 (90), s3 excluded
  assert.equal(review.summary.tasksWorkedOnCount, 2);
  assert.equal(review.dailyBreakdown.length, 3);
  assert.equal(review.dailyBreakdown[0].date, '2026-09-10');
  assert.equal(review.dailyBreakdown[2].date, '2026-09-12');
});

test('Progress Review Domain: Gracefully handles empty data period', () => {
  const period = {
    type: 'this-week' as const,
    startDate: '2026-09-21',
    endDate: '2026-09-27',
    label: 'This Week',
  };

  const review = calculateComprehensivePeriodReview({
    period,
    sessions: [],
    tasks: [],
    roadmaps: [],
    goals: [],
    weeklyPlans: [],
  });

  assert.equal(review.summary.totalPlannedMinutes, 0);
  assert.equal(review.summary.totalActualMinutes, 0);
  assert.equal(review.summary.varianceMinutes, 0);
  assert.equal(review.summary.tasksWorkedOnCount, 0);
  assert.equal(review.summary.tasksCompletedCount, 0);
  assert.equal(review.summary.plannedCommitmentsCount, 0);
  assert.equal(review.summary.completedCommitmentsCount, 0);
  assert.equal(review.goals.length, 0);
  assert.equal(review.roadmaps.length, 0);
  assert.equal(review.tasks.length, 0);
  assert.equal(review.dailyBreakdown.length, 7);
});

// -----------------------------------------------------------------------------
// 2. Application Service Integration Tests
// -----------------------------------------------------------------------------

test('ProgressService: getPeriodProgressReview works end-to-end with local repos', async () => {
  const repos = createLocalRepositories();
  const services = createApplicationServices({
    goals: repos.goals,
    roadmaps: repos.roadmaps,
    tasks: repos.tasks,
    sessions: repos.sessions,
    weeklyPlans: repos.weeklyPlans,
    weeklyPlanItems: repos.weeklyPlanItems,
  });

  // Create real data through services
  const goal = await services.goals.createGoal({
    title: 'Distributed Storage Engine',
  });

  const roadmap = await services.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'LSM-Tree Storage Engine',
  });

  const task = await services.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'MemTable implementation',
    estimatedMinutes: 120,
  });

  // Fetch progress for this week
  const review = await services.progress.getPeriodProgressReview({
    periodType: 'this-week',
    referenceDate: '2026-09-23',
  });

  assert.equal(review.period.type, 'this-week');
  assert.equal(review.period.weekIdentifier, '2026-W39');
  assert.equal(review.goals.length, 1);
  assert.equal(review.roadmaps.length, 1);
  assert.equal(review.dailyBreakdown.length, 7);
});

test('ProgressService: Validates date order on custom ranges', async () => {
  const repos = createLocalRepositories();
  const services = createApplicationServices({
    goals: repos.goals,
    roadmaps: repos.roadmaps,
    tasks: repos.tasks,
    sessions: repos.sessions,
    weeklyPlans: repos.weeklyPlans,
    weeklyPlanItems: repos.weeklyPlanItems,
  });

  await assert.rejects(
    async () => {
      await services.progress.getPeriodProgressReview({
        periodType: 'custom',
        customStartDate: '2026-09-25',
        customEndDate: '2026-09-20', // start follows end
      });
    },
    (err: any) => {
      assert.match(err.message, /Start date.*cannot follow end date/i);
      return true;
    }
  );
});

// -----------------------------------------------------------------------------
// 3. Translations and Localization Verification
// -----------------------------------------------------------------------------

test('Progress Review Translations: English and Persian keys are populated', () => {
  const requiredKeys = [
    'progressTitle',
    'progressSubtitle',
    'reviewPeriod',
    'lastWeek',
    'customRange',
    'actualTime',
    'plannedTime',
    'tasksCompleted',
    'tasksWorkedOn',
    'plannedCommitments',
    'completedCommitments',
    'difference',
    'plannedVsActual',
    'goalProgress',
    'roadmapProgress',
    'taskActivity',
    'dailyReview',
    'noActivityInPeriod',
    'noActivityInPeriodDesc',
    'activeGoals',
    'allGoals',
    'activeRoadmaps',
    'loadingProgress',
  ] as const;

  for (const key of requiredKeys) {
    const enVal = getTranslation(key as any, 'en');
    const faVal = getTranslation(key as any, 'fa');

    assert.ok(enVal && enVal.length > 0, `English key missing: ${key}`);
    assert.ok(faVal && faVal.length > 0, `Persian key missing: ${key}`);
    assert.notEqual(enVal, key, `Translation fallback occurred for en: ${key}`);
    assert.notEqual(faVal, key, `Translation fallback occurred for fa: ${key}`);
  }
});
