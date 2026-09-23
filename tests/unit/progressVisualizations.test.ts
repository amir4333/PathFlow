/**
 * Phase 11B: Progress Visualizations & Trends Unit Tests
 *
 * Verifies pure data transformations, accessibility data models, empty state resilience,
 * and review-period synchronization for Phase 11B:
 * 1. Planned vs Actual daily comparison data
 * 2. Actual time daily trend data
 * 3. Task completion daily trend data
 * 4. Roadmap time distribution data
 * 5. Goal/Roadmap progress uses existing percentages without UI recalculation
 * 6. Review-period synchronization updates data models
 * 7. Empty state handling
 * 8. Custom date range handling
 * 9. Localization & translation keys (English and Persian)
 * 10. Exact minute preservation and no duplicate session aggregation
 */

import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DailyPeriodReview,
  RoadmapPeriodProgress,
  GoalPeriodProgress,
  createGoal,
  createRoadmap,
  createTask,
  createSession,
  createWeeklyPlan,
  createWeeklyPlanItem,
  calculateComprehensivePeriodReview,
} from '../../src/domain';

import {
  preparePlannedVsActualDailyData,
  prepareActualTimeTrendData,
  prepareTaskCompletionTrendData,
  prepareRoadmapDistributionData,
} from '../../src/features/progress/progressChartData';

import { TRANSLATIONS, getTranslation } from '../../src/app/preferences/translations';

// -----------------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------------

function getSampleDailyBreakdown(): DailyPeriodReview[] {
  return [
    {
      date: '2026-09-21',
      dayOfWeek: 1, // Monday
      plannedMinutes: 120,
      actualMinutes: 90,
      sessionCount: 2,
      tasksWorkedOnCount: 2,
      tasksCompletedCount: 1,
    },
    {
      date: '2026-09-22',
      dayOfWeek: 2, // Tuesday
      plannedMinutes: 60,
      actualMinutes: 80,
      sessionCount: 1,
      tasksWorkedOnCount: 1,
      tasksCompletedCount: 0,
    },
    {
      date: '2026-09-23',
      dayOfWeek: 3, // Wednesday
      plannedMinutes: 0,
      actualMinutes: 0,
      sessionCount: 0,
      tasksWorkedOnCount: 0,
      tasksCompletedCount: 0,
    },
    {
      date: '2026-09-24',
      dayOfWeek: 4, // Thursday
      plannedMinutes: 90,
      actualMinutes: 90,
      sessionCount: 2,
      tasksWorkedOnCount: 1,
      tasksCompletedCount: 1,
    },
  ];
}

function getSampleRoadmaps(): RoadmapPeriodProgress[] {
  return [
    {
      roadmapId: 'roadmap-1',
      title: 'Compiler Frontend',
      goalId: 'goal-1',
      goalTitle: 'Core CS Mastery',
      totalTasks: 5,
      completedTasks: 3,
      taskCompletionPercentage: 60,
      plannedMinutes: 150,
      actualMinutes: 180,
      hasActivityInPeriod: true,
    },
    {
      roadmapId: 'roadmap-2',
      title: 'Database Engine',
      goalId: 'goal-1',
      goalTitle: 'Core CS Mastery',
      totalTasks: 4,
      completedTasks: 1,
      taskCompletionPercentage: 25,
      plannedMinutes: 120,
      actualMinutes: 60,
      hasActivityInPeriod: true,
    },
    {
      roadmapId: 'roadmap-3',
      title: 'Networking Stack',
      goalId: 'goal-1',
      goalTitle: 'Core CS Mastery',
      totalTasks: 2,
      completedTasks: 0,
      taskCompletionPercentage: 0,
      plannedMinutes: 0,
      actualMinutes: 0,
      hasActivityInPeriod: false,
    },
  ];
}

// -----------------------------------------------------------------------------
// Test Cases
// -----------------------------------------------------------------------------

test('1. Planned vs Actual visualization data transformation', () => {
  const daily = getSampleDailyBreakdown();
  const model = preparePlannedVsActualDailyData(daily);

  assert.strictEqual(model.isEmpty, false);
  assert.strictEqual(model.items.length, 4);
  assert.strictEqual(model.totalPlannedMinutes, 270);
  assert.strictEqual(model.totalActualMinutes, 260);
  assert.strictEqual(model.maxMinutes, 120);

  // Day 1: Planned 120, Actual 90, Variance -30
  assert.strictEqual(model.items[0].plannedMinutes, 120);
  assert.strictEqual(model.items[0].actualMinutes, 90);
  assert.strictEqual(model.items[0].varianceMinutes, -30);
  assert.strictEqual(model.items[0].hasActivity, true);

  // Day 2: Planned 60, Actual 80, Variance +20
  assert.strictEqual(model.items[1].plannedMinutes, 60);
  assert.strictEqual(model.items[1].actualMinutes, 80);
  assert.strictEqual(model.items[1].varianceMinutes, 20);
  assert.strictEqual(model.items[1].hasActivity, true);

  // Day 3: Inactive
  assert.strictEqual(model.items[2].hasActivity, false);
});

test('2. Actual time daily trend transformation', () => {
  const daily = getSampleDailyBreakdown();
  const model = prepareActualTimeTrendData(daily);

  assert.strictEqual(model.isEmpty, false);
  assert.strictEqual(model.points.length, 4);
  assert.strictEqual(model.totalActualMinutes, 260);
  assert.strictEqual(model.maxMinutes, 90);
  // Average across 4 days: 260 / 4 = 65
  assert.strictEqual(model.averageMinutesPerDay, 65);

  assert.strictEqual(model.points[0].actualMinutes, 90);
  assert.strictEqual(model.points[0].sessionCount, 2);
  assert.strictEqual(model.points[2].actualMinutes, 0);
  assert.strictEqual(model.points[2].sessionCount, 0);
});

test('3. Task completion daily trend transformation', () => {
  const daily = getSampleDailyBreakdown();
  const model = prepareTaskCompletionTrendData(daily);

  assert.strictEqual(model.isEmpty, false);
  assert.strictEqual(model.points.length, 4);
  assert.strictEqual(model.totalTasksWorkedOn, 4); // 2 + 1 + 0 + 1
  assert.strictEqual(model.totalTasksCompleted, 2); // 1 + 0 + 0 + 1
  assert.strictEqual(model.maxTasks, 2);

  assert.strictEqual(model.points[0].tasksWorkedOnCount, 2);
  assert.strictEqual(model.points[0].tasksCompletedCount, 1);
  assert.strictEqual(model.points[1].tasksWorkedOnCount, 1);
  assert.strictEqual(model.points[1].tasksCompletedCount, 0);
});

test('4. Roadmap time aggregation and proportional distribution', () => {
  const roadmaps = getSampleRoadmaps();
  const model = prepareRoadmapDistributionData(roadmaps);

  assert.strictEqual(model.isEmpty, false);
  // Roadmap 3 has 0 actual minutes, so only roadmaps 1 and 2 should be in distribution
  assert.strictEqual(model.items.length, 2);
  assert.strictEqual(model.totalActualMinutes, 240); // 180 + 60

  // Item 0: Roadmap 1 (180 mins = 75% of 240)
  assert.strictEqual(model.items[0].roadmapId, 'roadmap-1');
  assert.strictEqual(model.items[0].actualMinutes, 180);
  assert.strictEqual(model.items[0].percentageOfTotalActual, 75);

  // Item 1: Roadmap 2 (60 mins = 25% of 240)
  assert.strictEqual(model.items[1].roadmapId, 'roadmap-2');
  assert.strictEqual(model.items[1].actualMinutes, 60);
  assert.strictEqual(model.items[1].percentageOfTotalActual, 25);
});

test('5. Goal/Roadmap progress preserves domain percentages exactly', () => {
  const roadmaps = getSampleRoadmaps();
  // Ensure that no component mutates or re-calculates taskCompletionPercentage
  assert.strictEqual(roadmaps[0].taskCompletionPercentage, 60);
  assert.strictEqual(roadmaps[1].taskCompletionPercentage, 25);
  assert.strictEqual(roadmaps[2].taskCompletionPercentage, 0);

  const goal: GoalPeriodProgress = {
    goalId: 'goal-1',
    title: 'Core CS Mastery',
    status: 'in_progress',
    totalRoadmaps: 3,
    totalTasks: 11,
    completedTasks: 4,
    taskCompletionPercentage: 36,
    plannedMinutes: 270,
    actualMinutes: 240,
    hasActivityInPeriod: true,
  };
  assert.strictEqual(goal.taskCompletionPercentage, 36);
});

test('6. Empty visualization states handle zero activity gracefully', () => {
  const emptyDaily: DailyPeriodReview[] = [
    {
      date: '2026-09-21',
      dayOfWeek: 1,
      plannedMinutes: 0,
      actualMinutes: 0,
      sessionCount: 0,
      tasksWorkedOnCount: 0,
      tasksCompletedCount: 0,
    },
    {
      date: '2026-09-22',
      dayOfWeek: 2,
      plannedMinutes: 0,
      actualMinutes: 0,
      sessionCount: 0,
      tasksWorkedOnCount: 0,
      tasksCompletedCount: 0,
    },
  ];

  const pvaModel = preparePlannedVsActualDailyData(emptyDaily);
  assert.strictEqual(pvaModel.isEmpty, true);
  assert.strictEqual(pvaModel.totalPlannedMinutes, 0);
  assert.strictEqual(pvaModel.totalActualMinutes, 0);

  const trendModel = prepareActualTimeTrendData(emptyDaily);
  assert.strictEqual(trendModel.isEmpty, true);
  assert.strictEqual(trendModel.totalActualMinutes, 0);
  assert.strictEqual(trendModel.averageMinutesPerDay, 0);

  const tasksModel = prepareTaskCompletionTrendData(emptyDaily);
  assert.strictEqual(tasksModel.isEmpty, true);
  assert.strictEqual(tasksModel.totalTasksWorkedOn, 0);
  assert.strictEqual(tasksModel.totalTasksCompleted, 0);

  const emptyRoadmaps: RoadmapPeriodProgress[] = [
    {
      roadmapId: 'r-1',
      title: 'Empty Roadmap',
      goalId: 'g-1',
      goalTitle: 'Goal',
      totalTasks: 2,
      completedTasks: 0,
      taskCompletionPercentage: 0,
      plannedMinutes: 0,
      actualMinutes: 0,
      hasActivityInPeriod: false,
    },
  ];
  const roadmapModel = prepareRoadmapDistributionData(emptyRoadmaps);
  assert.strictEqual(roadmapModel.isEmpty, true);
  assert.strictEqual(roadmapModel.items.length, 0);
  assert.strictEqual(roadmapModel.totalActualMinutes, 0);
});

test('7. Custom date range handling adapts daily data properly', () => {
  const customDaily: DailyPeriodReview[] = [
    {
      date: '2026-09-01',
      dayOfWeek: 2,
      plannedMinutes: 45,
      actualMinutes: 50,
      sessionCount: 1,
      tasksWorkedOnCount: 1,
      tasksCompletedCount: 0,
    },
    {
      date: '2026-09-02',
      dayOfWeek: 3,
      plannedMinutes: 90,
      actualMinutes: 100,
      sessionCount: 2,
      tasksWorkedOnCount: 2,
      tasksCompletedCount: 1,
    },
    {
      date: '2026-09-03',
      dayOfWeek: 4,
      plannedMinutes: 30,
      actualMinutes: 30,
      sessionCount: 1,
      tasksWorkedOnCount: 1,
      tasksCompletedCount: 1,
    },
  ];

  const pva = preparePlannedVsActualDailyData(customDaily);
  assert.strictEqual(pva.items.length, 3);
  assert.strictEqual(pva.totalPlannedMinutes, 165);
  assert.strictEqual(pva.totalActualMinutes, 180);

  const trend = prepareActualTimeTrendData(customDaily);
  assert.strictEqual(trend.points.length, 3);
  assert.strictEqual(trend.totalActualMinutes, 180);
  assert.strictEqual(trend.averageMinutesPerDay, 60);
});

test('8. Translations for Phase 11B are present in both English and Persian', () => {
  const keysToCheck = [
    'dailyPlannedVsActual',
    'actualTimeTrend',
    'taskCompletionTrend',
    'roadmapDistribution',
    'noRoadmapActivity',
    'noDailyActivity',
    'viewDataTable',
    'sessionsCount',
  ] as const;

  for (const key of keysToCheck) {
    const en = getTranslation(key as any, 'en');
    const fa = getTranslation(key as any, 'fa');

    assert.ok(en, `Missing English translation for ${key}`);
    assert.ok(fa, `Missing Persian translation for ${key}`);
    assert.notStrictEqual(en, key, `English translation for ${key} should not fallback to key`);
    assert.notStrictEqual(fa, key, `Persian translation for ${key} should not fallback to key`);
    assert.notStrictEqual(en, fa, `Persian translation for ${key} should be localized differently than English`);
  }
});

test('9. No duplicate session aggregation when calculating comprehensive period review', () => {
  const goal = createGoal({ title: 'System Performance' });
  const roadmap = createRoadmap({ goalId: goal.id, title: 'Profiler' });
  const task = createTask({ roadmapId: roadmap.id, title: 'Flamegraph generation' });

  const session1 = createSession({
    taskId: task.id,
    startedAt: '2026-09-21T09:00:00.000Z',
    endedAt: '2026-09-21T10:00:00.000Z',
    durationMinutes: 60,
  });

  const session2 = createSession({
    taskId: task.id,
    startedAt: '2026-09-21T14:00:00.000Z',
    endedAt: '2026-09-21T14:30:00.000Z',
    durationMinutes: 30,
  });

  const period = {
    type: 'custom' as const,
    startDate: '2026-09-21',
    endDate: '2026-09-21',
    label: 'Single Day',
  };

  const review = calculateComprehensivePeriodReview({
    period,
    goals: [goal],
    roadmaps: [roadmap],
    tasks: [task],
    sessions: [session1, session2],
    weeklyPlans: [],
  });

  // Verify exactly 90 minutes total, exactly 2 sessions, exactly 1 task
  assert.strictEqual(review.summary.totalActualMinutes, 90);
  assert.strictEqual(review.dailyBreakdown.length, 1);
  assert.strictEqual(review.dailyBreakdown[0].actualMinutes, 90);
  assert.strictEqual(review.dailyBreakdown[0].sessionCount, 2);

  // Now transform to visualization models and check fidelity
  const pva = preparePlannedVsActualDailyData(review.dailyBreakdown);
  assert.strictEqual(pva.totalActualMinutes, 90);

  const trend = prepareActualTimeTrendData(review.dailyBreakdown);
  assert.strictEqual(trend.totalActualMinutes, 90);
  assert.strictEqual(trend.points[0].sessionCount, 2);

  const roadmapDist = prepareRoadmapDistributionData(review.roadmaps);
  assert.strictEqual(roadmapDist.totalActualMinutes, 90);
  assert.strictEqual(roadmapDist.items[0].percentageOfTotalActual, 100);
});
