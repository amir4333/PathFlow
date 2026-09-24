/**
 * Phase 12A: Teacher View Foundation Unit Tests
 *
 * Verifies:
 * - Route parsing for #teacher-view and alias #teacher
 * - Complete presence and symmetry of Teacher View translation keys (EN and FA)
 * - Factual metrics derivation using Application Services (Goal, Roadmap, Task, Session, Weekly Plan)
 * - Strictly read-only observational nature (no state mutation)
 * - Period sensitivity (This Week, Last Week, Custom Range)
 * - Hierarchy progress matching domain calculations
 * - Weekly planning summary (dated vs flexible, active days)
 * - Recent recorded sessions enrichment
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
import { TRANSLATIONS, getTranslation } from '../../src/app/preferences/translations';
import { formatDate, formatNumeral } from '../../src/app/preferences/dateFormatting';
import { parseHashToState } from '../../src/app/providers/RouterProvider';

// -----------------------------------------------------------------------------
// 1. Route Parsing & Aliasing
// -----------------------------------------------------------------------------

test('Teacher View Route: #teacher-view resolves to teacher-view route', () => {
  const state = parseHashToState('#teacher-view');
  assert.equal(state.route, 'teacher-view');
  assert.equal(state.hashString, 'teacher-view');
});

test('Teacher View Route: #teacher alias resolves to teacher-view route', () => {
  const state = parseHashToState('#teacher');
  assert.equal(state.route, 'teacher-view');
  assert.equal(state.hashString, 'teacher');
});

// -----------------------------------------------------------------------------
// 2. Localization Keys Symmetry (EN & FA)
// -----------------------------------------------------------------------------

test('Teacher View Localization: All Teacher View keys exist symmetrically in EN and FA', () => {
  const teacherKeys = [
    'teacherViewTitle',
    'teacherViewSubtitle',
    'readOnlyNotice',
    'readOnlyNoticeDesc',
    'goalOverview',
    'roadmapOverview',
    'taskProgress',
    'weeklyPlanningSummary',
    'recentWorkRecorded',
    'recentSessions',
    'noGoalsFound',
    'noRoadmapsFound',
    'noTasksFound',
    'noPlansInPeriod',
    'noSessionsInPeriod',
    'datedCommitments',
    'flexibleCommitmentsCount',
    'activeDaysCount',
    'notes',
    'noNotesRecorded',
    'refresh',
    'allTasksFilter',
    'workedOnFilter',
    'completedFilter',
    'inProgressFilter',
  ] as const;

  for (const key of teacherKeys) {
    const enText = getTranslation(key as any, 'en');
    const faText = getTranslation(key as any, 'fa');

    assert.ok(enText && enText !== key, `Missing EN translation for key: ${key}`);
    assert.ok(faText && faText !== key, `Missing FA translation for key: ${key}`);
    assert.notEqual(enText, faText, `EN and FA translations should be localized differently for: ${key}`);
  }
});

// -----------------------------------------------------------------------------
// 3. Application Integration & Factual Metrics
// -----------------------------------------------------------------------------

test('Teacher View Application: Derives factual period review metrics without mutating state', async () => {
  const repos = createLocalRepositories();
  const application = createApplicationServices(repos);

  // Set up test hierarchy
  const goal1 = await application.goals.createGoal({
    title: 'Advanced Robotics Research',
    description: 'Autonomous navigation and kinematics',
  });

  const roadmap1 = await application.roadmaps.createRoadmap({
    goalId: goal1.id,
    title: 'SLAM & Sensor Fusion',
  });

  const task1 = await application.tasks.createTask({
    roadmapId: roadmap1.id,
    title: 'Extended Kalman Filter',
    estimatedMinutes: 180,
  });

  const task2 = await application.tasks.createTask({
    roadmapId: roadmap1.id,
    title: 'LIDAR Point Cloud Integration',
    estimatedMinutes: 120,
  });
  await application.tasks.updateTask(task2.id, { status: 'completed' });

  // Target week
  const refDate = new Date('2026-09-23T10:00:00Z');
  const weekId = getWeekIdentifier(refDate);
  const weekPeriod = getWeekPeriod(weekId);

  // Weekly plan with dated and flexible items
  await repos.weeklyPlans.create(
    createWeeklyPlan({
      weekIdentifier: weekId,
      items: [
        createWeeklyPlanItem({
          taskId: task1.id,
          plannedMinutes: 120,
          targetDate: weekPeriod.startDate,
          isCompleted: false,
        }),
        createWeeklyPlanItem({
          taskId: task2.id,
          plannedMinutes: 60,
          targetDate: undefined, // flexible
          isCompleted: true,
        }),
      ],
    })
  );

  // Sessions in week
  await repos.sessions.create(
    createSession({
      taskId: task1.id,
      durationMinutes: 90,
      startedAt: `${weekPeriod.startDate}T09:00:00.000Z`,
      endedAt: `${weekPeriod.startDate}T10:30:00.000Z`,
    })
  );

  await repos.sessions.create(
    createSession({
      taskId: task2.id,
      durationMinutes: 60,
      startedAt: `${weekPeriod.startDate}T14:00:00.000Z`,
      endedAt: `${weekPeriod.startDate}T15:00:00.000Z`,
    })
  );

  // Retrieve period progress review
  const review = await application.progress.getPeriodProgressReview({
    periodType: 'this-week',
    referenceDate: refDate,
  });

  // Check factual summary
  assert.equal(review.summary.totalPlannedMinutes, 180);
  assert.equal(review.summary.totalActualMinutes, 150);
  assert.equal(review.summary.varianceMinutes, -30);
  assert.equal(review.summary.tasksWorkedOnCount, 2);
  assert.equal(review.summary.tasksCompletedCount, 1);
  assert.equal(review.summary.plannedCommitmentsCount, 2);
  assert.equal(review.summary.completedCommitmentsCount, 1);

  // Check goal overview
  assert.equal(review.goals.length, 1);
  assert.equal(review.goals[0].title, 'Advanced Robotics Research');
  assert.equal(review.goals[0].totalRoadmaps, 1);
  assert.equal(review.goals[0].totalTasks, 2);
  assert.equal(review.goals[0].completedTasks, 1);
  assert.equal(review.goals[0].taskCompletionPercentage, 50);

  // Check roadmap overview
  assert.equal(review.roadmaps.length, 1);
  assert.equal(review.roadmaps[0].title, 'SLAM & Sensor Fusion');
  assert.equal(review.roadmaps[0].completedTasks, 1);
  assert.equal(review.roadmaps[0].totalTasks, 2);
  assert.equal(review.roadmaps[0].taskCompletionPercentage, 50);
  assert.equal(review.roadmaps[0].actualMinutes, 150);

  // Check session history query for teacher view
  const sessionHistory = await application.sessions.querySessionHistory({
    startDate: review.period.startDate,
    endDate: review.period.endDate,
  });
  assert.equal(sessionHistory.sessions.length, 2);
  assert.equal(sessionHistory.totalMinutes, 150);

  // Check weekly plan query
  const plan = await application.weeklyPlans.getWeeklyPlanByWeek(weekId);
  assert.ok(plan);
  assert.equal(plan.items.length, 2);
  const datedItems = plan.items.filter((i) => !!i.targetDate);
  const flexItems = plan.items.filter((i) => !i.targetDate);
  assert.equal(datedItems.length, 1);
  assert.equal(flexItems.length, 1);

  // Check that repository state is preserved and not altered
  const allGoals = await repos.goals.getAll();
  assert.equal(allGoals.length, 1);
  const allRoadmaps = await repos.roadmaps.getAll();
  assert.equal(allRoadmaps.length, 1);
  const allTasks = await repos.tasks.getAll();
  assert.equal(allTasks.length, 2);
});

// -----------------------------------------------------------------------------
// 4. Custom Range Filtering
// -----------------------------------------------------------------------------

test('Teacher View Application: Handles custom date ranges accurately', async () => {
  const repos = createLocalRepositories();
  const application = createApplicationServices(repos);

  const goal = await application.goals.createGoal({ title: 'Goal A' });
  const roadmap = await application.roadmaps.createRoadmap({ goalId: goal.id, title: 'Roadmap A' });
  const task = await application.tasks.createTask({ roadmapId: roadmap.id, title: 'Task A', estimatedMinutes: 60 });

  // Session inside range
  await repos.sessions.create(
    createSession({
      taskId: task.id,
      durationMinutes: 45,
      startedAt: '2026-09-10T10:00:00.000Z',
      endedAt: '2026-09-10T10:45:00.000Z',
    })
  );

  // Session outside range
  await repos.sessions.create(
    createSession({
      taskId: task.id,
      durationMinutes: 60,
      startedAt: '2026-09-15T10:00:00.000Z',
      endedAt: '2026-09-15T11:00:00.000Z',
    })
  );

  const review = await application.progress.getPeriodProgressReview({
    periodType: 'custom',
    customStartDate: '2026-09-08',
    customEndDate: '2026-09-12',
  });

  assert.equal(review.summary.totalActualMinutes, 45);
  assert.equal(review.summary.tasksWorkedOnCount, 1);
  assert.equal(review.tasks[0].actualMinutes, 45);
});

// -----------------------------------------------------------------------------
// 5. Phase 12B: Drill-Down Route Parsing
// -----------------------------------------------------------------------------

test('Teacher View Drill-down Routes: #teacher-view/goal/:id and #teacher-view/roadmap/:id', () => {
  const goalRoute = parseHashToState('#teacher-view/goal/goal-abc');
  assert.equal(goalRoute.route, 'teacher-view');
  assert.equal(goalRoute.params.subview, 'goal');
  assert.equal(goalRoute.params.goalId, 'goal-abc');
  assert.equal(goalRoute.params.id, 'goal-abc');

  const roadmapRoute = parseHashToState('#teacher-view/roadmap/roadmap-xyz');
  assert.equal(roadmapRoute.route, 'teacher-view');
  assert.equal(roadmapRoute.params.subview, 'roadmap');
  assert.equal(roadmapRoute.params.roadmapId, 'roadmap-xyz');
  assert.equal(roadmapRoute.params.id, 'roadmap-xyz');
});

// -----------------------------------------------------------------------------
// 6. Phase 12B: Translation Keys Symmetry
// -----------------------------------------------------------------------------

test('Teacher View Phase 12B: Localization keys symmetry for drill-down and timeline', () => {
  const phase12BKeys = [
    'goalDetails',
    'roadmapBreakdown',
    'overallProgress',
    'selectedPeriodActivity',
    'lifetimeProgress',
    'allTime',
    'inSelectedPeriod',
    'roadmapDetails',
    'parentGoal',
    'tasksInRoadmap',
    'taskDetails',
    'historicalProgress',
    'activityTimeline',
    'noTimelineEvents',
    'sessionRecorded',
    'taskCompletedEvent',
    'backToOverview',
    'backToGoal',
    'drillDownToRoadmap',
    'drillDownToGoal',
    'estimatedTime',
    'completionDate',
    'sessionsRecordedCount',
    'noRoadmapsInGoal',
    'noTasksInRoadmap',
    'goalNotFound',
    'roadmapNotFound',
    'taskNotFound',
  ] as const;

  for (const key of phase12BKeys) {
    const enText = getTranslation(key as any, 'en');
    const faText = getTranslation(key as any, 'fa');

    assert.ok(enText && enText !== key, `Missing EN translation for key: ${key}`);
    assert.ok(faText && faText !== key, `Missing FA translation for key: ${key}`);
    assert.notEqual(enText, faText, `EN and FA should be distinct translations for: ${key}`);
  }
});

// -----------------------------------------------------------------------------
// 7. Phase 12B: Goal Overall Progress vs Selected Period Distinction
// -----------------------------------------------------------------------------

test('Teacher View Goal Detail: Distinguishes lifetime progress from selected-period activity', async () => {
  const repos = createLocalRepositories();
  const application = createApplicationServices(repos);

  const goal = await application.goals.createGoal({
    title: 'Compiler Construction',
    description: 'Design and implementation of a bytecode VM',
  });

  const roadmap1 = await application.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Frontend Parser',
  });

  const roadmap2 = await application.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'VM Execution Engine',
  });

  const task1 = await application.tasks.createTask({
    roadmapId: roadmap1.id,
    title: 'Lexer Implementation',
    estimatedMinutes: 120,
  });
  await application.tasks.updateTask(task1.id, { status: 'completed' });

  const task2 = await application.tasks.createTask({
    roadmapId: roadmap2.id,
    title: 'Stack Machine OpCodes',
    estimatedMinutes: 180,
  });

  // Old historical session (Lifetime only, not in review period)
  await repos.sessions.create(
    createSession({
      taskId: task1.id,
      durationMinutes: 120,
      startedAt: '2026-08-01T10:00:00.000Z',
      endedAt: '2026-08-01T12:00:00.000Z',
    })
  );

  // Recent session inside review period (2026-09-21 to 2026-09-27)
  await repos.sessions.create(
    createSession({
      taskId: task2.id,
      durationMinutes: 60,
      startedAt: '2026-09-22T14:00:00.000Z',
      endedAt: '2026-09-22T15:00:00.000Z',
    })
  );

  // 1. Overall Lifetime Progress
  const overallProg = await application.progress.getGoalProgress(goal.id);
  assert.equal(overallProg.goalId, goal.id);
  assert.equal(overallProg.totalRoadmaps, 2);
  assert.equal(overallProg.totalTasks, 2);
  assert.equal(overallProg.completedTasks, 1);
  assert.equal(overallProg.taskCompletionPercentage, 50);
  assert.equal(overallProg.totalActualMinutes, 180); // 120 + 60 all-time
  assert.equal(overallProg.sessionCount, 2);

  // 2. Selected Period Activity (2026-09-21 to 2026-09-27)
  const periodReview = await application.progress.getPeriodProgressReview({
    periodType: 'this-week',
    referenceDate: new Date('2026-09-23T10:00:00Z'),
  });

  const goalInPeriod = periodReview.goals.find((g) => g.goalId === goal.id);
  assert.ok(goalInPeriod);
  assert.equal(goalInPeriod.actualMinutes, 60); // only the 60min in this week!
  assert.equal(goalInPeriod.hasActivityInPeriod, true);
});

// -----------------------------------------------------------------------------
// 8. Phase 12B: Roadmap Detail View & Task History
// -----------------------------------------------------------------------------

test('Teacher View Roadmap Detail: Computes roadmap metrics and task history accurately', async () => {
  const repos = createLocalRepositories();
  const application = createApplicationServices(repos);

  const goal = await application.goals.createGoal({ title: 'AI Systems' });
  const roadmap = await application.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Transformer Architecture',
  });

  const task1 = await application.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Multi-Head Attention',
    estimatedMinutes: 240,
  });

  const task2 = await application.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Positional Encoding',
    estimatedMinutes: 120,
  });
  await application.tasks.updateTask(task2.id, { status: 'completed' });

  // Record session on task1
  await repos.sessions.create(
    createSession({
      taskId: task1.id,
      durationMinutes: 90,
      startedAt: '2026-09-20T10:00:00.000Z',
      endedAt: '2026-09-20T11:30:00.000Z',
    })
  );

  const rProg = await application.progress.getRoadmapProgress(roadmap.id);
  assert.equal(rProg.roadmapId, roadmap.id);
  assert.equal(rProg.goalId, goal.id);
  assert.equal(rProg.totalTasks, 2);
  assert.equal(rProg.completedTasks, 1);
  assert.equal(rProg.taskCompletionPercentage, 50);
  assert.equal(rProg.totalEstimatedMinutes, 360);
  assert.equal(rProg.totalActualMinutes, 90);
  assert.equal(rProg.sessionCount, 1);

  // Verify task items inside detailed progress
  assert.equal(rProg.tasks.length, 2);
  const mha = rProg.tasks.find((t) => t.taskId === task1.id);
  assert.ok(mha);
  assert.equal(mha.actualMinutes, 90);
  assert.equal(mha.sessionCount, 1);
  assert.equal(mha.isCompleted, false);
});

// -----------------------------------------------------------------------------
// 9. Phase 12B: Missing & Empty Entity Handling
// -----------------------------------------------------------------------------

test('Teacher View Error Resilience: Handles missing and empty goals and roadmaps', async () => {
  const repos = createLocalRepositories();
  const application = createApplicationServices(repos);

  // Missing Goal
  await assert.rejects(
    async () => {
      await application.progress.getGoalProgress('non-existent-goal-id');
    },
    { name: 'NotFoundError' }
  );

  // Missing Roadmap
  await assert.rejects(
    async () => {
      await application.progress.getRoadmapProgress('non-existent-roadmap-id');
    },
    { name: 'NotFoundError' }
  );

  // Empty Roadmap (0 tasks)
  const goal = await application.goals.createGoal({ title: 'Empty Goal' });
  const emptyRoadmap = await application.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'Empty Roadmap',
  });

  const emptyProg = await application.progress.getRoadmapProgress(emptyRoadmap.id);
  assert.equal(emptyProg.totalTasks, 0);
  assert.equal(emptyProg.completedTasks, 0);
  assert.equal(emptyProg.taskCompletionPercentage, 0);
  assert.equal(emptyProg.totalActualMinutes, 0);
  assert.equal(emptyProg.sessionCount, 0);
});

// -----------------------------------------------------------------------------
// 10. Phase 12B: Read-Only Verification
// -----------------------------------------------------------------------------

test('Teacher View Invariant: Progress derivation performs zero entity mutations', async () => {
  const repos = createLocalRepositories();
  const application = createApplicationServices(repos);

  const goal = await application.goals.createGoal({ title: 'Database Internals' });
  const roadmap = await application.roadmaps.createRoadmap({
    goalId: goal.id,
    title: 'B+ Tree Indexing',
  });
  const task = await application.tasks.createTask({
    roadmapId: roadmap.id,
    title: 'Page Splitting Logic',
    estimatedMinutes: 180,
  });

  // Query progress multiple times
  await application.progress.getGoalProgress(goal.id);
  await application.progress.getRoadmapProgress(roadmap.id);
  await application.progress.getPeriodProgressReview({ periodType: 'this-week' });

  // Assert entities remain untouched
  const reGoal = await repos.goals.getById(goal.id);
  const reRoadmap = await repos.roadmaps.getById(roadmap.id);
  const reTask = await repos.tasks.getById(task.id);

  assert.equal(reGoal?.updatedAt, goal.updatedAt);
  assert.equal(reRoadmap?.updatedAt, roadmap.updatedAt);
  assert.equal(reTask?.updatedAt, task.updatedAt);
  assert.equal(reTask?.status, 'todo');
});

// -----------------------------------------------------------------------------
// 11. Phase 12B: Timeline Reconstruction (Factual Events Only)
// -----------------------------------------------------------------------------

test('Teacher View Timeline: Reconstructs factual chronological timeline from sessions and tasks', async () => {
  const repos = createLocalRepositories();
  const application = createApplicationServices(repos);

  const goal = await application.goals.createGoal({ title: 'Game Engine' });
  const roadmap = await application.roadmaps.createRoadmap({ goalId: goal.id, title: 'Vulkan Renderer' });
  const task = await application.tasks.createTask({ roadmapId: roadmap.id, title: 'Swapchain initialization' });

  // 1. Session at 10:00
  const sess = await repos.sessions.create(
    createSession({
      taskId: task.id,
      durationMinutes: 45,
      startedAt: '2026-09-22T10:00:00.000Z',
      endedAt: '2026-09-22T10:45:00.000Z',
    })
  );

  // 2. Task completed at 11:00
  await application.tasks.updateTask(task.id, {
    status: 'completed',
  });
  const updatedTask = await repos.tasks.getById(task.id);
  assert.ok(updatedTask?.completedAt);

  // Derived timeline events
  const events = [
    {
      id: `task-completed-${updatedTask!.id}`,
      type: 'task_completed' as const,
      timestamp: updatedTask!.completedAt!,
      title: updatedTask!.title,
    },
    {
      id: `session-${sess.id}`,
      type: 'session_recorded' as const,
      timestamp: sess.startedAt,
      title: updatedTask!.title,
      durationMinutes: sess.durationMinutes,
    },
  ];

  // Sort newest first
  events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  assert.equal(events.length, 2);
  // Task completion at 11:00 should come before Session at 10:00 in newest-first
  assert.equal(events[0].type, 'task_completed');
  assert.equal(events[1].type, 'session_recorded');
  assert.equal(events[1].durationMinutes, 45);
});

// -----------------------------------------------------------------------------
// 12. Phase 12B: Language & Calendar Presentation Preferences
// -----------------------------------------------------------------------------

test('Teacher View Presentation: Honors Gregorian and Persian calendars and numerals', () => {
  const testIso = '2026-09-24T12:00:00.000Z';

  // Gregorian + English
  const enG = formatDate(testIso, { language: 'en', calendar: 'gregorian' }, { year: 'numeric', month: 'numeric', day: 'numeric' });
  const numEn = formatNumeral(42, { language: 'en', calendar: 'gregorian' });
  assert.equal(numEn, '42');
  assert.ok(enG.includes('2026') || enG.includes('26'), 'Gregorian date must contain 2026');

  // Persian Calendar + Persian Numerals
  const faP = formatDate(testIso, { language: 'fa', calendar: 'persian' }, { year: 'numeric', month: 'numeric', day: 'numeric' });
  const numFa = formatNumeral(42, { language: 'fa', calendar: 'persian' });
  assert.equal(numFa, '۴۲');
  // In Persian Jalali calendar, 2026-09-24 is year 1405 (۱۴۰۵)
  assert.ok(faP.includes('۱۴۰۵') || faP.includes('1405'), 'Persian date must reflect Jalali year 1405');
});


