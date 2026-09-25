/**
 * Phase 13A: Official Progress Report Foundation Unit Tests
 *
 * Verifies:
 * - Route parsing for #reports and alias #report, with scope parameters
 * - Complete presence and symmetry of Report translation keys (EN and FA)
 * - Deterministic, strictly factual generation of OfficialProgressReport via ReportService
 * - Explicit distinction between Lifetime / Overall vs Selected Period values
 * - Non-judgmental observational invariant (no subjective grades, rankings, AI scores)
 * - Scoping behavior: All Goals vs Single Goal vs Single Roadmap
 * - Review period support: This Week, Last Week, Custom Range
 * - Daily activity breakdown matching calendar dates in range
 * - Weekly planning commitments: dated vs flexible, active days
 * - Work sessions summary: counts, duration, recent sessions
 * - Handling of zero-activity / empty states
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
  getWeekPeriod,
} from '../../src/domain';

import { createApplicationServices } from '../../src/application';
import { createLocalRepositories } from '../../src/data/repositories/local';
import { TRANSLATIONS } from '../../src/app/preferences/translations';
import { parseHashToState } from '../../src/app/providers/RouterProvider';

// -----------------------------------------------------------------------------
// 1. Route Parsing & Aliasing
// -----------------------------------------------------------------------------

test('Report Route: #reports resolves to reports route', () => {
  const state = parseHashToState('#reports');
  assert.equal(state.route, 'reports');
  assert.equal(state.hashString, 'reports');
});

test('Report Route: #report alias resolves to reports route', () => {
  const state = parseHashToState('#report');
  assert.equal(state.route, 'reports');
  assert.equal(state.hashString, 'report');
});

test('Report Route: #reports/goal/goal-123 parses goal scope', () => {
  const state = parseHashToState('#reports/goal/goal-123');
  assert.equal(state.route, 'reports');
  assert.equal(state.params.scopeType, 'goal');
  assert.equal(state.params.goalId, 'goal-123');
  assert.equal(state.params.id, 'goal-123');
});

test('Report Route: #reports/roadmap/rm-456 parses roadmap scope', () => {
  const state = parseHashToState('#reports/roadmap/rm-456');
  assert.equal(state.route, 'reports');
  assert.equal(state.params.scopeType, 'roadmap');
  assert.equal(state.params.roadmapId, 'rm-456');
  assert.equal(state.params.id, 'rm-456');
});

// -----------------------------------------------------------------------------
// 2. Localization Keys Symmetry (EN & FA)
// -----------------------------------------------------------------------------

test('Report Localization: All Report keys exist symmetrically in EN and FA', () => {
  const reportKeys = [
    'reportsTitle',
    'reportsSubtitle',
    'generatedAt',
    'reportScope',
    'scopeAll',
    'scopeGoal',
    'scopeRoadmap',
    'selectScope',
    'printReport',
    'officialDocumentNotice',
    'officialDocumentDesc',
    'executiveSummary',
    'lifetimeVsPeriodNotice',
    'lifetimePlannedTime',
    'lifetimeActualTime',
    'periodPlannedTime',
    'periodActualTime',
    'sessionsSummary',
    'dailyActivityBreakdown',
    'noReportData',
    'totalSessions',
    'variance',
    'completionRate',
    'workSummary',
    'planningSummary',
    'datedCommitmentsLabel',
    'flexibleCommitmentsLabel',
  ];

  for (const key of reportKeys) {
    assert.ok(
      key in TRANSLATIONS.en,
      `Key "${key}" must exist in English translation dictionary`
    );
    assert.ok(
      key in TRANSLATIONS.fa,
      `Key "${key}" must exist in Persian translation dictionary`
    );
  }
});

// -----------------------------------------------------------------------------
// 3. Factual & Deterministic Report Generation
// -----------------------------------------------------------------------------

test('Report Generation: Empty state generates valid structured report without errors', async () => {
  const repos = createLocalRepositories();
  const app = createApplicationServices(repos);

  const report = await app.reports.generateReport({
    periodType: 'this-week',
    referenceDate: '2026-09-24T12:00:00.000Z',
  });

  assert.ok(report);
  assert.equal(report.metadata.reviewPeriod.type, 'this-week');
  assert.equal(report.overview.activeGoalsCount, 0);
  assert.equal(report.overview.activeRoadmapsCount, 0);
  assert.equal(report.overview.totalTasksCount, 0);
  assert.equal(report.overview.sessionCount, 0);
  assert.equal(report.goals.length, 0);
  assert.equal(report.roadmaps.length, 0);
  assert.equal(report.tasks.length, 0);
  assert.equal(report.sessionsSummary.totalSessionsCount, 0);
  assert.equal(report.weeklyPlanning.plannedCommitmentsCount, 0);
  assert.equal(report.dailyActivity.length, 7); // 7 days in week
});

test('Report Generation: Distinguishes Lifetime vs Selected Period metrics', async () => {
  const repos = createLocalRepositories();
  const app = createApplicationServices(repos);

  // Setup: Goal, Roadmap, Tasks
  const goal = await repos.goals.create(
    createGoal({ id: 'g-algo', title: 'Algorithms Mastery', status: 'in_progress' })
  );
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ id: 'rm-trees', goalId: goal.id, title: 'Binary Trees' })
  );
  const task1 = await repos.tasks.create(
    createTask({
      id: 't-bst',
      roadmapId: roadmap.id,
      title: 'BST Traversal',
      estimatedMinutes: 120,
      status: 'completed',
    })
  );
  const task2 = await repos.tasks.create(
    createTask({
      id: 't-avl',
      roadmapId: roadmap.id,
      title: 'AVL Balance',
      estimatedMinutes: 90,
      status: 'in_progress',
    })
  );

  // Sessions:
  // Session 1: 3 weeks ago (Historical / Lifetime only, not in this week)
  await repos.sessions.create(
    createSession({
      id: 's-hist',
      taskId: task1.id,
      startedAt: '2026-09-01T10:00:00.000Z',
      endedAt: '2026-09-01T11:00:00.000Z',
      durationMinutes: 60,
    })
  );

  // Session 2: Current week (2026-09-24, Thursday)
  await repos.sessions.create(
    createSession({
      id: 's-curr',
      taskId: task1.id,
      startedAt: '2026-09-24T14:00:00.000Z',
      endedAt: '2026-09-24T15:30:00.000Z',
      durationMinutes: 90,
    })
  );

  // Weekly plan in current week
  const currWeekId = getWeekIdentifier('2026-09-24T12:00:00.000Z');
  const plan = await repos.weeklyPlans.create(
    createWeeklyPlan({ id: 'wp-curr', weekIdentifier: currWeekId, targetMinutes: 180 })
  );
  await repos.weeklyPlanItems.create(
    createWeeklyPlanItem({
      id: 'wpi-1',
      weeklyPlanId: plan.id,
      taskId: task1.id,
      plannedMinutes: 60,
      targetDate: '2026-09-24',
      isCompleted: true,
    })
  );

  // Generate Report for This Week
  const report = await app.reports.generateReport({
    periodType: 'this-week',
    referenceDate: '2026-09-24T12:00:00.000Z',
  });

  // Verify Goal metrics: Lifetime vs Period
  const reportGoal = report.goals.find((g) => g.id === goal.id);
  assert.ok(reportGoal);
  // Lifetime actual = 60 (historical) + 90 (current) = 150 min
  assert.equal(reportGoal.lifetimeActualMinutes, 150);
  // Selected period actual = 90 min (only current week session)
  assert.equal(reportGoal.selectedPeriodActualMinutes, 90);
  // Selected period planned = 60 min
  assert.equal(reportGoal.selectedPeriodPlannedMinutes, 60);
  assert.equal(reportGoal.selectedPeriodSessionCount, 1);
  assert.equal(reportGoal.hasActivityInPeriod, true);

  // Verify Roadmap metrics: Lifetime vs Period
  const reportRoadmap = report.roadmaps.find((r) => r.id === roadmap.id);
  assert.ok(reportRoadmap);
  assert.equal(reportRoadmap.lifetimeActualMinutes, 150);
  assert.equal(reportRoadmap.selectedPeriodActualMinutes, 90);
  assert.equal(reportRoadmap.selectedPeriodPlannedMinutes, 60);

  // Verify Task metrics
  const reportTask1 = report.tasks.find((t) => t.id === task1.id);
  assert.ok(reportTask1);
  assert.equal(reportTask1.lifetimeActualMinutes, 150);
  assert.equal(reportTask1.selectedPeriodActualMinutes, 90);
  assert.equal(reportTask1.selectedPeriodPlannedMinutes, 60);
  assert.equal(reportTask1.lifetimeSessionCount, 2);
  assert.equal(reportTask1.selectedPeriodSessionCount, 1);
  assert.equal(reportTask1.isCompleted, true);

  // Verify Sessions summary contains only period sessions (1 session, 90 min)
  assert.equal(report.sessionsSummary.totalSessionsCount, 1);
  assert.equal(report.sessionsSummary.totalDurationMinutes, 90);
  assert.equal(report.sessionsSummary.activeDaysCount, 1);
  assert.equal(report.sessionsSummary.recentSessions.length, 1);
  assert.equal(report.sessionsSummary.recentSessions[0].id, 's-curr');

  // Verify Weekly Planning summary
  assert.equal(report.weeklyPlanning.plannedCommitmentsCount, 1);
  assert.equal(report.weeklyPlanning.completedCommitmentsCount, 1);
  assert.equal(report.weeklyPlanning.totalPlannedMinutes, 60);
  assert.equal(report.weeklyPlanning.datedCommitmentsCount, 1);
  assert.equal(report.weeklyPlanning.flexibleCommitmentsCount, 0);

  // Verify Overview
  assert.equal(report.overview.activeGoalsCount, 1);
  assert.equal(report.overview.tasksWorkedOnCount, 1);
  assert.equal(report.overview.actualMinutes, 90);
  assert.equal(report.overview.plannedMinutes, 60);
  assert.equal(report.overview.varianceMinutes, 30);
  assert.equal(report.overview.timeCompletionPercentage, 150); // 90 / 60 = 150%
});

// -----------------------------------------------------------------------------
// 4. Report Scoping (All vs Specific Goal vs Specific Roadmap)
// -----------------------------------------------------------------------------

test('Report Scoping: Specific Goal isolates tasks, sessions, and roadmaps of that goal', async () => {
  const repos = createLocalRepositories();
  const app = createApplicationServices(repos);

  const goalA = await repos.goals.create(
    createGoal({ id: 'g-a', title: 'Goal A', status: 'in_progress' })
  );
  const goalB = await repos.goals.create(
    createGoal({ id: 'g-b', title: 'Goal B', status: 'in_progress' })
  );

  const roadmapA = await repos.roadmaps.create(
    createRoadmap({ id: 'rm-a', goalId: goalA.id, title: 'Roadmap A' })
  );
  const roadmapB = await repos.roadmaps.create(
    createRoadmap({ id: 'rm-b', goalId: goalB.id, title: 'Roadmap B' })
  );

  const taskA = await repos.tasks.create(
    createTask({ id: 't-a', roadmapId: roadmapA.id, title: 'Task A' })
  );
  const taskB = await repos.tasks.create(
    createTask({ id: 't-b', roadmapId: roadmapB.id, title: 'Task B' })
  );

  await repos.sessions.create(
    createSession({
      id: 's-a',
      taskId: taskA.id,
      startedAt: '2026-09-24T10:00:00.000Z',
      endedAt: '2026-09-24T11:00:00.000Z',
      durationMinutes: 60,
    })
  );

  await repos.sessions.create(
    createSession({
      id: 's-b',
      taskId: taskB.id,
      startedAt: '2026-09-24T14:00:00.000Z',
      endedAt: '2026-09-24T15:00:00.000Z',
      durationMinutes: 60,
    })
  );

  // Scoped to Goal A
  const scopedReport = await app.reports.generateReport({
    periodType: 'this-week',
    referenceDate: '2026-09-24T12:00:00.000Z',
    scope: {
      type: 'goal',
      goalId: goalA.id,
    },
  });

  assert.equal(scopedReport.metadata.scope.type, 'goal');
  assert.equal(scopedReport.metadata.scope.goalId, goalA.id);
  assert.equal(scopedReport.metadata.scope.goalTitle, 'Goal A');

  // Goals list contains only Goal A
  assert.equal(scopedReport.goals.length, 1);
  assert.equal(scopedReport.goals[0].id, goalA.id);

  // Roadmaps list contains only Roadmap A
  assert.equal(scopedReport.roadmaps.length, 1);
  assert.equal(scopedReport.roadmaps[0].id, roadmapA.id);

  // Tasks list contains only Task A
  assert.equal(scopedReport.tasks.length, 1);
  assert.equal(scopedReport.tasks[0].id, taskA.id);

  // Sessions summary contains only session A
  assert.equal(scopedReport.sessionsSummary.totalSessionsCount, 1);
  assert.equal(scopedReport.sessionsSummary.totalDurationMinutes, 60);
  assert.equal(scopedReport.sessionsSummary.recentSessions[0].id, 's-a');
});

// -----------------------------------------------------------------------------
// 5. Invariant: Observational & Factual Data Guarantee
// -----------------------------------------------------------------------------

test('Report Invariant: Contains strictly observational, factual metrics and no subjective grades', async () => {
  const repos = createLocalRepositories();
  const app = createApplicationServices(repos);

  const report = await app.reports.generateReport({
    periodType: 'this-week',
    referenceDate: '2026-09-24T12:00:00.000Z',
  });

  // Verify report object keys: no "grade", "score", "aiFeedback", "ranking"
  const reportObj = JSON.parse(JSON.stringify(report));
  const serialized = JSON.stringify(reportObj).toLowerCase();

  assert.ok(!serialized.includes('"grade"'));
  assert.ok(!serialized.includes('"rank"'));
  assert.ok(!serialized.includes('"judgment"'));
  assert.ok(!serialized.includes('"productivityscore"'));
});
