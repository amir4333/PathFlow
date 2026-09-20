import test from 'node:test';
import assert from 'node:assert/strict';

import {
  // Common & DateRange
  generateEntityId,
  createTimestamp,
  getWeekIdentifier,
  createDateRange,
  isValidDateRange,
  isDateWithinRange,
  getDatesInRange,
  getDaysCountInRange,
  getTodayPeriod,
  getThisWeekPeriod,
  getPreviousWeekPeriod,
  getLastNDaysPeriod,
  getWeekPeriod,

  // Domain Models
  createGoal,
  createRoadmap,
  createTask,
  createSession,
  createWeeklyPlan,
  createWeeklyPlanItem,
  Goal,
  Roadmap,
  Task,
  Session,
  WeeklyPlan,

  // Progress Review Domain Service
  calculatePlannedVsActual,
  calculateDailyProgressSummary,
  calculateWeeklyReviewSummary,
  calculateDetailedRoadmapProgress,
  calculateDetailedGoalProgress,
  aggregateActivityByDate,
  aggregateActivityByWeek,
  aggregateActivityByTask,
  aggregateActivityByRoadmap,
  aggregateActivityByGoal,
  calculateProgressOverTime,
  calculatePeriodProgressSummary,
  reconstructProjectHistory,
  generateProgressReviewReport,
} from '../../src/domain/index';

// -----------------------------------------------------------------------------
// 1. Date Ranges and Standard Period Helpers
// -----------------------------------------------------------------------------

test('Date Ranges: Validates and constructs date range boundaries', () => {
  const range = createDateRange('2026-09-14', '2026-09-20', 'Sprint 38');
  assert.equal(range.startDate, '2026-09-14');
  assert.equal(range.endDate, '2026-09-20');
  assert.equal(range.label, 'Sprint 38');
  assert.equal(isValidDateRange(range), true);

  // Single-day range
  const singleDay = createDateRange('2026-09-15', '2026-09-15');
  assert.equal(getDaysCountInRange(singleDay), 1);
  assert.deepEqual(getDatesInRange(singleDay), ['2026-09-15']);

  // 7-day range
  assert.equal(getDaysCountInRange(range), 7);
  const dates7 = getDatesInRange(range);
  assert.equal(dates7.length, 7);
  assert.equal(dates7[0], '2026-09-14');
  assert.equal(dates7[6], '2026-09-20');

  // Boundary checks
  assert.equal(isDateWithinRange('2026-09-13', range), false);
  assert.equal(isDateWithinRange('2026-09-14', range), true);
  assert.equal(isDateWithinRange('2026-09-17', range), true);
  assert.equal(isDateWithinRange('2026-09-20', range), true);
  assert.equal(isDateWithinRange('2026-09-21', range), false);

  // Invariant rejections
  assert.throws(() => createDateRange('invalid', '2026-09-20'));
  assert.throws(() => createDateRange('2026-09-20', '2026-09-14')); // start > end
  assert.equal(isValidDateRange({ startDate: '2026-09-20', endDate: '2026-09-14' }), false);
  assert.equal(isValidDateRange(null), false);
});

test('Standard Review Periods: Generates deterministic periods (Today, This Week, Last N Days)', () => {
  const refDate = new Date('2026-09-16T10:00:00.000Z'); // Wednesday of 2026-W38

  const today = getTodayPeriod(refDate);
  assert.equal(today.startDate, '2026-09-16');
  assert.equal(today.endDate, '2026-09-16');

  const thisWeek = getThisWeekPeriod(refDate);
  assert.equal(thisWeek.startDate, '2026-09-14'); // Monday
  assert.equal(thisWeek.endDate, '2026-09-20');   // Sunday

  const prevWeek = getPreviousWeekPeriod(refDate);
  assert.equal(prevWeek.startDate, '2026-09-07'); // Monday of W37
  assert.equal(prevWeek.endDate, '2026-09-13');   // Sunday of W37

  const last7Days = getLastNDaysPeriod(7, refDate);
  assert.equal(last7Days.endDate, '2026-09-16');
  assert.equal(last7Days.startDate, '2026-09-10');
  assert.equal(getDaysCountInRange(last7Days), 7);

  const last30Days = getLastNDaysPeriod(30, refDate);
  assert.equal(getDaysCountInRange(last30Days), 30);
});

// -----------------------------------------------------------------------------
// 2. Daily Progress Summary
// -----------------------------------------------------------------------------

test('Daily Progress: Empty day with no sessions or plans returns clean zeroes', () => {
  const summary = calculateDailyProgressSummary('2026-09-15', [], []);
  assert.equal(summary.date, '2026-09-15');
  assert.equal(summary.totalActualMinutes, 0);
  assert.equal(summary.sessionCount, 0);
  assert.equal(summary.plannedMinutes, 0);
  assert.equal(summary.workedOnTaskCount, 0);
  assert.equal(summary.completedTaskCount, 0);
  assert.equal(summary.taskCompletionPercentage, 0);
  assert.equal(summary.timeCompletionPercentage, 0);
  assert.equal(summary.plannedVsActual.varianceMinutes, 0);
  assert.equal(summary.tasksWorkedOn.length, 0);
  assert.equal(summary.tasksCompleted.length, 0);
});

test('Daily Progress: Planned work with no actual work performed', () => {
  const roadmapId = generateEntityId();
  const task = createTask({ roadmapId, title: 'Write Compiler Frontend', estimatedMinutes: 120 });
  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [
      createWeeklyPlanItem({
        taskId: task.id,
        targetDate: '2026-09-15',
        plannedMinutes: 120,
      }),
    ],
  });

  const summary = calculateDailyProgressSummary('2026-09-15', [], [task], [plan]);
  assert.equal(summary.plannedMinutes, 120);
  assert.equal(summary.totalActualMinutes, 0);
  assert.equal(summary.sessionCount, 0);
  assert.equal(summary.plannedVsActual.varianceMinutes, -120); // under budget / not performed
  assert.equal(summary.plannedVsActual.percentage, 0);
  assert.equal(summary.taskCompletionPercentage, 0);
  assert.equal(summary.workedOnTaskCount, 0);
});

test('Daily Progress: Actual work performed with no planned commitment for that day', () => {
  const roadmapId = generateEntityId();
  const task = createTask({ roadmapId, title: 'Bug Investigation' });
  const session = createSession({
    taskId: task.id,
    startedAt: '2026-09-15T10:00:00.000Z',
    endedAt: '2026-09-15T11:15:00.000Z', // 75 minutes
  });

  const summary = calculateDailyProgressSummary('2026-09-15', [session], [task]);
  assert.equal(summary.plannedMinutes, 0);
  assert.equal(summary.totalActualMinutes, 75);
  assert.equal(summary.sessionCount, 1);
  assert.equal(summary.plannedVsActual.varianceMinutes, 75);
  assert.equal(summary.plannedVsActual.percentage, 0); // divide-by-zero avoided
  assert.equal(summary.workedOnTaskCount, 1);
  assert.equal(summary.tasksWorkedOn[0].taskId, task.id);
  assert.equal(summary.tasksWorkedOn[0].actualMinutes, 75);
});

test('Daily Progress: Planned and actual work with multiple sessions and completed tasks', () => {
  const roadmapId = generateEntityId();
  const task1 = createTask({ roadmapId, title: 'AST Parser', status: 'completed' });
  const task2 = createTask({ roadmapId, title: 'Type Checker', status: 'in_progress' });

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [
      createWeeklyPlanItem({ taskId: task1.id, targetDate: '2026-09-15', plannedMinutes: 60 }),
      createWeeklyPlanItem({ taskId: task2.id, targetDate: '2026-09-15', plannedMinutes: 60 }),
    ],
  });

  const s1 = createSession({
    taskId: task1.id,
    startedAt: '2026-09-15T09:00:00.000Z',
    endedAt: '2026-09-15T09:50:00.000Z', // 50m
  });
  const s2 = createSession({
    taskId: task1.id,
    startedAt: '2026-09-15T11:00:00.000Z',
    endedAt: '2026-09-15T11:20:00.000Z', // 20m (total 70m on task1)
  });
  const s3 = createSession({
    taskId: task2.id,
    startedAt: '2026-09-15T14:00:00.000Z',
    endedAt: '2026-09-15T14:40:00.000Z', // 40m
  });
  // Session on a different date (should be excluded)
  const sOther = createSession({
    taskId: task1.id,
    startedAt: '2026-09-16T10:00:00.000Z',
    endedAt: '2026-09-16T11:00:00.000Z',
  });

  const summary = calculateDailyProgressSummary(
    '2026-09-15',
    [s1, s2, s3, sOther],
    [task1, task2],
    [plan]
  );

  assert.equal(summary.plannedMinutes, 120);
  assert.equal(summary.totalActualMinutes, 110);
  assert.equal(summary.sessionCount, 3);
  assert.equal(summary.plannedVsActual.varianceMinutes, -10);
  assert.equal(summary.plannedVsActual.percentage, 92); // 110 / 120 * 100
  assert.equal(summary.workedOnTaskCount, 2);
  assert.equal(summary.completedTaskCount, 1);
  assert.equal(summary.taskCompletionPercentage, 50); // 1 of 2 planned tasks completed

  // Task 1 had 70m (s1 + s2), Task 2 had 40m
  assert.equal(summary.tasksWorkedOn[0].taskId, task1.id);
  assert.equal(summary.tasksWorkedOn[0].actualMinutes, 70);
  assert.equal(summary.tasksWorkedOn[0].sessionCount, 2);
  assert.equal(summary.tasksWorkedOn[0].varianceMinutes, 10); // 70 actual - 60 planned

  assert.equal(summary.tasksWorkedOn[1].taskId, task2.id);
  assert.equal(summary.tasksWorkedOn[1].actualMinutes, 40);
  assert.equal(summary.tasksWorkedOn[1].sessionCount, 1);
  assert.equal(summary.tasksWorkedOn[1].varianceMinutes, -20); // 40 actual - 60 planned
});

// -----------------------------------------------------------------------------
// 3. Weekly Progress Review (Current & Historical Weeks)
// -----------------------------------------------------------------------------

test('Weekly Progress: Historical week with no weekly plan aggregates actual historical sessions safely', () => {
  const goal = createGoal({ title: 'System Performance' });
  const roadmap = createRoadmap({ goalId: goal.id, title: 'Memory Profiler' });
  const task = createTask({ roadmapId: roadmap.id, title: 'Heap Allocation Tracing', status: 'completed' });

  // Sessions in week 2026-W37 (2026-09-07 to 2026-09-13)
  const session1 = createSession({
    taskId: task.id,
    startedAt: '2026-09-08T10:00:00.000Z',
    endedAt: '2026-09-08T11:00:00.000Z', // 60m
  });
  const session2 = createSession({
    taskId: task.id,
    startedAt: '2026-09-10T14:00:00.000Z',
    endedAt: '2026-09-10T15:30:00.000Z', // 90m
  });

  const review = calculateWeeklyReviewSummary(
    '2026-W37',
    [session1, session2],
    [task],
    [roadmap],
    [goal],
    null // no plan
  );

  assert.equal(review.weekIdentifier, '2026-W37');
  assert.equal(review.hasWeeklyPlan, false);
  assert.equal(review.plannedMinutes, 0);
  assert.equal(review.actualMinutes, 150);
  assert.equal(review.sessionCount, 2);
  assert.equal(review.tasksWorkedOnCount, 1);
  assert.equal(review.tasksCompletedCount, 1);
  assert.equal(review.taskCompletionPercentage, 100);
  assert.equal(review.plannedVsActual.varianceMinutes, 150);

  // Roadmap & Goal progress included
  assert.equal(review.roadmapProgress.length, 1);
  assert.equal(review.roadmapProgress[0].roadmapId, roadmap.id);
  assert.equal(review.roadmapProgress[0].actualMinutes, 150);
  assert.equal(review.goalProgress.length, 1);
  assert.equal(review.goalProgress[0].goalId, goal.id);
  assert.equal(review.goalProgress[0].actualMinutes, 150);
});

test('Weekly Progress: Overtime week (actual > planned)', () => {
  const goal = createGoal({ title: 'Game Engine' });
  const roadmap = createRoadmap({ goalId: goal.id, title: 'Renderer' });
  const task = createTask({ roadmapId: roadmap.id, title: 'Vulkan Pipeline', status: 'completed' });

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    targetMinutes: 100,
    items: [
      createWeeklyPlanItem({ taskId: task.id, plannedMinutes: 100 }),
    ],
  });

  const session = createSession({
    taskId: task.id,
    startedAt: '2026-09-15T09:00:00.000Z',
    endedAt: '2026-09-15T11:30:00.000Z', // 150m
  });

  const review = calculateWeeklyReviewSummary(
    '2026-W38',
    [session],
    [task],
    [roadmap],
    [goal],
    plan
  );

  assert.equal(review.plannedMinutes, 100);
  assert.equal(review.actualMinutes, 150);
  assert.equal(review.plannedVsActual.varianceMinutes, 50); // overtime
  assert.equal(review.timeCompletionPercentage, 150);
  assert.equal(review.taskCompletionPercentage, 100);
});

// -----------------------------------------------------------------------------
// 4. Project, Roadmap & Goal Multi-Level Progress
// -----------------------------------------------------------------------------

test('Detailed Roadmap Progress: Accurately evaluates tasks, statuses, estimates, and actuals', () => {
  const goal = createGoal({ title: 'Embedded Systems' });
  const roadmap = createRoadmap({ goalId: goal.id, title: 'Driver Development' });

  const t1 = createTask({ roadmapId: roadmap.id, title: 'UART Driver', estimatedMinutes: 60, status: 'completed' });
  const t2 = createTask({ roadmapId: roadmap.id, title: 'SPI Driver', estimatedMinutes: 90, status: 'in_progress' });
  const t3 = createTask({ roadmapId: roadmap.id, title: 'I2C Driver', estimatedMinutes: 60, status: 'todo' });
  const tCancelled = createTask({ roadmapId: roadmap.id, title: 'Deprecated CAN', estimatedMinutes: 60, status: 'cancelled' });

  // 1 session on t1 (50m), 1 session on t2 (60m), 1 session on tCancelled (20m before cancellation)
  const s1 = createSession({ taskId: t1.id, startedAt: '2026-09-14T10:00:00.000Z', endedAt: '2026-09-14T10:50:00.000Z' });
  const s2 = createSession({ taskId: t2.id, startedAt: '2026-09-15T14:00:00.000Z', endedAt: '2026-09-15T15:00:00.000Z' });
  const sCan = createSession({ taskId: tCancelled.id, startedAt: '2026-09-13T09:00:00.000Z', endedAt: '2026-09-13T09:20:00.000Z' });

  const rProg = calculateDetailedRoadmapProgress(roadmap, [t1, t2, t3, tCancelled], [s1, s2, sCan]);

  assert.equal(rProg.totalTasks, 4);
  assert.equal(rProg.activeTasks, 3); // excludes cancelled from active
  assert.equal(rProg.completedTasks, 1);
  assert.equal(rProg.inProgressTasks, 1);
  assert.equal(rProg.todoTasks, 1);
  assert.equal(rProg.cancelledTasks, 1);
  assert.equal(rProg.taskCompletionPercentage, 33); // 1 / 3 * 100

  // Estimated: 60 + 90 + 60 + 60 = 270m
  assert.equal(rProg.totalEstimatedMinutes, 270);
  // Actual: 50 + 60 + 20 = 130m (cancelled task effort is preserved!)
  assert.equal(rProg.totalActualMinutes, 130);
  assert.equal(rProg.sessionCount, 3);
  assert.equal(rProg.varianceMinutes, 130 - 270); // -140m
  assert.equal(rProg.tasks.length, 4);
});

test('Detailed Goal Progress: Aggregates multiple roadmaps transparently', () => {
  const goal = createGoal({ title: 'Full Stack Engineering' });
  const rFrontend = createRoadmap({ goalId: goal.id, title: 'Frontend Client' });
  const rBackend = createRoadmap({ goalId: goal.id, title: 'Backend API' });

  const tFront = createTask({ roadmapId: rFrontend.id, title: 'UI Views', estimatedMinutes: 100, status: 'completed' });
  const tBack = createTask({ roadmapId: rBackend.id, title: 'REST Endpoints', estimatedMinutes: 150, status: 'completed' });

  const sFront = createSession({ taskId: tFront.id, startedAt: '2026-09-14T10:00:00.000Z', endedAt: '2026-09-14T11:40:00.000Z' }); // 100m
  const sBack = createSession({ taskId: tBack.id, startedAt: '2026-09-15T10:00:00.000Z', endedAt: '2026-09-15T12:00:00.000Z' }); // 120m

  const gProg = calculateDetailedGoalProgress(goal, [rFrontend, rBackend], [tFront, tBack], [sFront, sBack]);

  assert.equal(gProg.totalRoadmaps, 2);
  assert.equal(gProg.completedRoadmaps, 2);
  assert.equal(gProg.totalTasks, 2);
  assert.equal(gProg.completedTasks, 2);
  assert.equal(gProg.taskCompletionPercentage, 100);
  assert.equal(gProg.totalEstimatedMinutes, 250);
  assert.equal(gProg.totalActualMinutes, 220);
  assert.equal(gProg.sessionCount, 2);
  assert.equal(gProg.roadmaps.length, 2);
});

// -----------------------------------------------------------------------------
// 5. Historical Activity Aggregations (Date, Week, Task, Roadmap, Goal)
// -----------------------------------------------------------------------------

test('Historical Aggregation: Groups activity by date, week, task, roadmap, and goal', () => {
  const goal = createGoal({ title: 'Algorithms' });
  const roadmap = createRoadmap({ goalId: goal.id, title: 'Graphs' });
  const task1 = createTask({ roadmapId: roadmap.id, title: 'Dijkstra' });
  const task2 = createTask({ roadmapId: roadmap.id, title: 'A* Search' });

  const s1 = createSession({
    taskId: task1.id,
    startedAt: '2026-09-14T10:00:00.000Z',
    endedAt: '2026-09-14T11:00:00.000Z', // 60m
  });
  const s2 = createSession({
    taskId: task1.id,
    startedAt: '2026-09-15T10:00:00.000Z',
    endedAt: '2026-09-15T10:30:00.000Z', // 30m
  });
  const s3 = createSession({
    taskId: task2.id,
    startedAt: '2026-09-15T14:00:00.000Z',
    endedAt: '2026-09-15T15:30:00.000Z', // 90m
  });

  const sessions = [s1, s2, s3];
  const tasks = [task1, task2];
  const roadmaps = [roadmap];
  const goals = [goal];

  // Aggregation by Date
  const byDate = aggregateActivityByDate(sessions);
  assert.equal(byDate.length, 2);
  assert.equal(byDate[0].date, '2026-09-14');
  assert.equal(byDate[0].totalActualMinutes, 60);
  assert.equal(byDate[0].distinctTasksWorkedOn, 1);
  assert.equal(byDate[1].date, '2026-09-15');
  assert.equal(byDate[1].totalActualMinutes, 120);
  assert.equal(byDate[1].distinctTasksWorkedOn, 2);

  // Aggregation by Week
  const byWeek = aggregateActivityByWeek(sessions);
  assert.equal(byWeek.length, 1);
  assert.equal(byWeek[0].weekIdentifier, '2026-W38');
  assert.equal(byWeek[0].totalActualMinutes, 180);
  assert.equal(byWeek[0].sessionCount, 3);
  assert.equal(byWeek[0].distinctTasksWorkedOn, 2);

  // Aggregation by Task
  const byTask = aggregateActivityByTask(sessions, tasks);
  assert.equal(byTask.length, 2);
  assert.equal(byTask[0].taskId, task1.id); // 90m
  assert.equal(byTask[0].totalActualMinutes, 90);
  assert.equal(byTask[0].sessionCount, 2);
  assert.equal(byTask[1].taskId, task2.id); // 90m
  assert.equal(byTask[1].totalActualMinutes, 90);

  // Aggregation by Roadmap
  const byRoadmap = aggregateActivityByRoadmap(sessions, tasks, roadmaps);
  assert.equal(byRoadmap.length, 1);
  assert.equal(byRoadmap[0].roadmapId, roadmap.id);
  assert.equal(byRoadmap[0].totalActualMinutes, 180);

  // Aggregation by Goal
  const byGoal = aggregateActivityByGoal(sessions, tasks, roadmaps, goals);
  assert.equal(byGoal.length, 1);
  assert.equal(byGoal[0].goalId, goal.id);
  assert.equal(byGoal[0].totalActualMinutes, 180);
  assert.equal(byGoal[0].distinctRoadmapsWorkedOn, 1);
  assert.equal(byGoal[0].distinctTasksWorkedOn, 2);
});

// -----------------------------------------------------------------------------
// 6. Progress Over Time (Chronological Time Series)
// -----------------------------------------------------------------------------

test('Progress Over Time: Generates continuous time series with cumulative actuals and planned', () => {
  const range = createDateRange('2026-09-14', '2026-09-17'); // 4 days (Mon to Thu)
  const roadmapId = generateEntityId();
  const task = createTask({ roadmapId, title: 'Compiler Optimization', status: 'completed' });

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [
      createWeeklyPlanItem({ taskId: task.id, targetDate: '2026-09-14', plannedMinutes: 60 }),
      createWeeklyPlanItem({ taskId: task.id, targetDate: '2026-09-15', plannedMinutes: 60 }),
      createWeeklyPlanItem({ taskId: task.id, targetDate: '2026-09-16', plannedMinutes: 60 }),
    ],
  });

  const s1 = createSession({
    taskId: task.id,
    startedAt: '2026-09-14T10:00:00.000Z',
    endedAt: '2026-09-14T11:00:00.000Z', // 60m
  });
  const s2 = createSession({
    taskId: task.id,
    startedAt: '2026-09-15T10:00:00.000Z',
    endedAt: '2026-09-15T11:30:00.000Z', // 90m
  });
  // Day 3 (2026-09-16) has 0 actual minutes
  // Day 4 (2026-09-17) has 45 actual minutes unplanned
  const s4 = createSession({
    taskId: task.id,
    startedAt: '2026-09-17T14:00:00.000Z',
    endedAt: '2026-09-17T14:45:00.000Z', // 45m
  });

  const series = calculateProgressOverTime({
    range,
    sessions: [s1, s2, s4],
    weeklyPlans: [plan],
    tasks: [task],
  });

  assert.equal(series.length, 4);

  // Day 1: Mon 14
  assert.equal(series[0].date, '2026-09-14');
  assert.equal(series[0].plannedMinutes, 60);
  assert.equal(series[0].actualMinutes, 60);
  assert.equal(series[0].cumulativePlannedMinutes, 60);
  assert.equal(series[0].cumulativeActualMinutes, 60);

  // Day 2: Tue 15
  assert.equal(series[1].date, '2026-09-15');
  assert.equal(series[1].plannedMinutes, 60);
  assert.equal(series[1].actualMinutes, 90);
  assert.equal(series[1].cumulativePlannedMinutes, 120);
  assert.equal(series[1].cumulativeActualMinutes, 150);

  // Day 3: Wed 16 (0 actual)
  assert.equal(series[2].date, '2026-09-16');
  assert.equal(series[2].plannedMinutes, 60);
  assert.equal(series[2].actualMinutes, 0);
  assert.equal(series[2].cumulativePlannedMinutes, 180);
  assert.equal(series[2].cumulativeActualMinutes, 150);

  // Day 4: Thu 17 (unplanned 45m)
  assert.equal(series[3].date, '2026-09-17');
  assert.equal(series[3].plannedMinutes, 0);
  assert.equal(series[3].actualMinutes, 45);
  assert.equal(series[3].cumulativePlannedMinutes, 180);
  assert.equal(series[3].cumulativeActualMinutes, 195);
  assert.equal(series[3].cumulativeVarianceMinutes, 15);
});

// -----------------------------------------------------------------------------
// 7. Period Progress Summary (Arbitrary Date Range)
// -----------------------------------------------------------------------------

test('Period Progress Summary: Accurately summarizes multi-week or custom ranges', () => {
  const range = createDateRange('2026-09-01', '2026-09-30', 'September Month');
  const roadmapId = generateEntityId();
  const task = createTask({ roadmapId, title: '3D Mesh Generator' });

  const s1 = createSession({
    taskId: task.id,
    startedAt: '2026-09-05T10:00:00.000Z',
    endedAt: '2026-09-05T11:00:00.000Z', // 60m
  });
  const s2 = createSession({
    taskId: task.id,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T11:30:00.000Z', // 90m
  });
  // Outside range session
  const sOut = createSession({
    taskId: task.id,
    startedAt: '2026-10-01T10:00:00.000Z',
    endedAt: '2026-10-01T11:00:00.000Z',
  });

  const periodSummary = calculatePeriodProgressSummary(
    range,
    [s1, s2, sOut],
    [task]
  );

  assert.equal(periodSummary.totalActualMinutes, 150);
  assert.equal(periodSummary.totalSessions, 2);
  assert.equal(periodSummary.distinctTasksWorkedOn, 1);
  assert.equal(periodSummary.dailyTimePoints.length, 30);
});

// -----------------------------------------------------------------------------
// 8. Historical Project Reconstruction
// -----------------------------------------------------------------------------

test('Historical Reconstruction: Reconstructs project state up to an asOfDate', () => {
  const goal = createGoal({ title: 'Robotics OS' });
  const roadmap = createRoadmap({ goalId: goal.id, title: 'Navigation' });
  const task = createTask({ roadmapId: roadmap.id, title: 'SLAM', estimatedMinutes: 200 });

  const s1 = createSession({
    taskId: task.id,
    startedAt: '2026-09-10T10:00:00.000Z',
    endedAt: '2026-09-10T11:00:00.000Z', // 60m
  });
  const s2 = createSession({
    taskId: task.id,
    startedAt: '2026-09-18T10:00:00.000Z',
    endedAt: '2026-09-18T11:00:00.000Z', // 60m
  });

  // Reconstruct as of 2026-09-12 (only s1 should be included)
  const snapshotPast = reconstructProjectHistory({
    goals: [goal],
    roadmaps: [roadmap],
    tasks: [task],
    sessions: [s1, s2],
    asOfDate: '2026-09-12',
  });
  assert.equal(snapshotPast.totalActualMinutes, 60);
  assert.equal(snapshotPast.totalSessions, 1);

  // Reconstruct current (all sessions)
  const snapshotCurrent = reconstructProjectHistory({
    goals: [goal],
    roadmaps: [roadmap],
    tasks: [task],
    sessions: [s1, s2],
  });
  assert.equal(snapshotCurrent.totalActualMinutes, 120);
  assert.equal(snapshotCurrent.totalSessions, 2);
});

// -----------------------------------------------------------------------------
// 9. Full Progress Review Report (For Future Teacher / Student View)
// -----------------------------------------------------------------------------

test('Teacher / Student Progress Review Report: Compiles executive, hierarchical, and trend data', () => {
  const goal = createGoal({ title: 'Physics Engine' });
  const roadmap = createRoadmap({ goalId: goal.id, title: 'Rigid Body Dynamics' });
  const task = createTask({ roadmapId: roadmap.id, title: 'Collision Manifolds', estimatedMinutes: 120, status: 'completed' });
  const session = createSession({
    taskId: task.id,
    startedAt: '2026-09-15T09:00:00.000Z',
    endedAt: '2026-09-15T11:00:00.000Z', // 120m
  });
  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [createWeeklyPlanItem({ taskId: task.id, plannedMinutes: 120, isCompleted: true })],
  });

  const report = generateProgressReviewReport({
    goals: [goal],
    roadmaps: [roadmap],
    tasks: [task],
    sessions: [session],
    weeklyPlans: [plan],
    period: createDateRange('2026-09-14', '2026-09-20'),
  });

  assert.ok(report.generatedAt);
  assert.equal(report.executiveSummary.totalActualMinutes, 120);
  assert.equal(report.executiveSummary.totalEstimatedMinutes, 120);
  assert.equal(report.executiveSummary.totalPlannedMinutes, 120);
  assert.equal(report.executiveSummary.completedTasks, 1);
  assert.equal(report.executiveSummary.overallTaskCompletionPercentage, 100);
  assert.equal(report.executiveSummary.overallTimeCompletionPercentage, 100);
  assert.equal(report.goals.length, 1);
  assert.equal(report.roadmaps.length, 1);
  assert.equal(report.recentWeeks.length, 1);
  assert.equal(report.timeSeries.length, 7);
});

// -----------------------------------------------------------------------------
// 10. Historical Data Integrity & Immutability
// -----------------------------------------------------------------------------

test('Historical Integrity: Pure calculation functions do NOT mutate input records', () => {
  const goal = Object.freeze(createGoal({ title: 'Immutable Goal' }));
  const roadmap = Object.freeze(createRoadmap({ goalId: goal.id, title: 'Immutable Roadmap' }));
  const task = Object.freeze(createTask({ roadmapId: roadmap.id, title: 'Immutable Task', estimatedMinutes: 60 }));
  const session = Object.freeze(createSession({
    taskId: task.id,
    startedAt: '2026-09-15T10:00:00.000Z',
    endedAt: '2026-09-15T11:00:00.000Z',
  }));
  const plan = Object.freeze(createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [Object.freeze(createWeeklyPlanItem({ taskId: task.id, plannedMinutes: 60 }))],
  }));

  const goals = Object.freeze([goal]);
  const roadmaps = Object.freeze([roadmap]);
  const tasks = Object.freeze([task]);
  const sessions = Object.freeze([session]);
  const plans = Object.freeze([plan]);

  // Executing all review functions should execute cleanly without runtime mutation errors
  assert.doesNotThrow(() => {
    calculateDailyProgressSummary('2026-09-15', sessions, tasks, plans);
    calculateWeeklyReviewSummary('2026-W38', sessions, tasks, roadmaps, goals, plan);
    calculateDetailedRoadmapProgress(roadmap, tasks, sessions, plans);
    calculateDetailedGoalProgress(goal, roadmaps, tasks, sessions, plans);
    aggregateActivityByDate(sessions);
    aggregateActivityByWeek(sessions);
    aggregateActivityByTask(sessions, tasks);
    aggregateActivityByRoadmap(sessions, tasks, roadmaps);
    aggregateActivityByGoal(sessions, tasks, roadmaps, goals);
    calculatePeriodProgressSummary(createDateRange('2026-09-14', '2026-09-20'), sessions, tasks, plans);
    reconstructProjectHistory({ goals, roadmaps, tasks, sessions, weeklyPlans: plans });
    generateProgressReviewReport({ goals, roadmaps, tasks, sessions, weeklyPlans: plans });
  });
});

// -----------------------------------------------------------------------------
// 11. Unified Domain Architecture (Academic vs Game Systems Lab)
// -----------------------------------------------------------------------------

test('Unified Domain: Academic Learning and Game Systems Lab share identical progress infrastructure', () => {
  // Academic Learning Goal
  const academicGoal = createGoal({ title: 'Master Computer Systems', description: 'Academic Focus' });
  const academicRoadmap = createRoadmap({ goalId: academicGoal.id, title: 'Operating Systems & Kernels' });
  const academicTask = createTask({ roadmapId: academicRoadmap.id, title: 'Virtual Memory Paging', estimatedMinutes: 90, status: 'completed' });
  const academicSession = createSession({
    taskId: academicTask.id,
    startedAt: '2026-09-15T09:00:00.000Z',
    endedAt: '2026-09-15T10:30:00.000Z', // 90m
  });

  // Game Systems Lab Goal
  const gslGoal = createGoal({ title: 'Game Systems Lab', description: 'Systems Architecture' });
  const gslRoadmap = createRoadmap({ goalId: gslGoal.id, title: 'Spatial Indexing' });
  const gslTask = createTask({ roadmapId: gslRoadmap.id, title: 'BVH Acceleration Tree', estimatedMinutes: 120, status: 'completed' });
  const gslSession = createSession({
    taskId: gslTask.id,
    startedAt: '2026-09-15T11:00:00.000Z',
    endedAt: '2026-09-15T13:00:00.000Z', // 120m
  });

  const allGoals = [academicGoal, gslGoal];
  const allRoadmaps = [academicRoadmap, gslRoadmap];
  const allTasks = [academicTask, gslTask];
  const allSessions = [academicSession, gslSession];

  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W38',
    items: [
      createWeeklyPlanItem({ taskId: academicTask.id, targetDate: '2026-09-15', plannedMinutes: 90, isCompleted: true }),
      createWeeklyPlanItem({ taskId: gslTask.id, targetDate: '2026-09-15', plannedMinutes: 120, isCompleted: true }),
    ],
  });

  // Both domains calculate seamlessly under identical services
  const dailySummary = calculateDailyProgressSummary('2026-09-15', allSessions, allTasks, [plan]);
  assert.equal(dailySummary.totalActualMinutes, 210);
  assert.equal(dailySummary.workedOnTaskCount, 2);
  assert.equal(dailySummary.completedTaskCount, 2);
  assert.equal(dailySummary.taskCompletionPercentage, 100);

  const weeklyReview = calculateWeeklyReviewSummary('2026-W38', allSessions, allTasks, allRoadmaps, allGoals, plan);
  assert.equal(weeklyReview.actualMinutes, 210);
  assert.equal(weeklyReview.roadmapProgress.length, 2);
  assert.equal(weeklyReview.goalProgress.length, 2);

  // Academic goal review
  const academicGoalRev = weeklyReview.goalProgress.find((g) => g.goalId === academicGoal.id);
  assert.equal(academicGoalRev?.actualMinutes, 90);
  assert.equal(academicGoalRev?.taskCompletionPercentage, 100);

  // Game Systems Lab goal review
  const gslGoalRev = weeklyReview.goalProgress.find((g) => g.goalId === gslGoal.id);
  assert.equal(gslGoalRev?.actualMinutes, 120);
  assert.equal(gslGoalRev?.taskCompletionPercentage, 100);
});
