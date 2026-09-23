/**
 * Session History UX & Daily Grouping Unit Tests (Phase 9C-2)
 *
 * Verifies:
 * 1. Sessions grouped into correct calendar days.
 * 2. Multiple sessions on the same day.
 * 3. Daily total duration (exact sum and formatted hours/minutes).
 * 4. Daily session count (exact count and localized plural/singular format).
 * 5. Different days remain separate and sorted newest-day-first.
 * 6. Filtered results are grouped correctly without UI filter duplication.
 * 7. Persian calendar grouping (Jalali date keys, Persian formatted dates).
 * 8. Gregorian calendar grouping (Gregorian date keys, Gregorian formatted dates).
 * 9. Today/Yesterday relative labels (English & Persian while preserving calendar date).
 * 10. Existing session filtering behavior remains completely unchanged.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import {
  PathFlowDB,
  createLocalRepositories,
} from '../../src/data';

import {
  createApplicationServices,
} from '../../src/application';

import {
  groupSessionsByDay,
  getCalendarDayKey,
  getRelativeDayLabel,
} from '../../src/features/sessions/sessionGrouping';

import {
  formatDurationHoursMinutes,
} from '../../src/app/preferences/dateFormatting';

function setupServices(dbName = `test_p9c2_${Date.now()}_${Math.random()}`) {
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
  return { db, repos, services };
}

test('1. Sessions grouped into correct calendar days', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Math' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Calculus' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Limits' });

  const session = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T11:00:00.000Z', // 60m
  });

  const groups = groupSessionsByDay([session], {
    language: 'en',
    calendar: 'gregorian',
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].dateKey, '2026-09-20');
  assert.equal(groups[0].formattedDate, 'September 20, 2026');
  assert.equal(groups[0].sessions.length, 1);
  assert.equal(groups[0].sessions[0].id, session.id);
});

test('2. Multiple sessions on the same day are grouped together', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Computer Science' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Systems' });
  const taskA = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Data Structures' });
  const taskB = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Operating Systems' });

  // Morning session on Sep 21
  const s1 = await services.sessions.createManualSession({
    taskId: taskA.id,
    startedAt: '2026-09-21T09:00:00.000Z',
    endedAt: '2026-09-21T10:20:00.000Z', // 80m (1h 20m)
  });

  // Afternoon session on Sep 21
  const s2 = await services.sessions.createManualSession({
    taskId: taskB.id,
    startedAt: '2026-09-21T14:00:00.000Z',
    endedAt: '2026-09-21T14:45:00.000Z', // 45m
  });

  const groups = groupSessionsByDay([s1, s2], {
    language: 'en',
    calendar: 'gregorian',
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].dateKey, '2026-09-21');
  assert.equal(groups[0].sessions.length, 2);
  // Ordered newest first
  assert.equal(groups[0].sessions[0].id, s2.id);
  assert.equal(groups[0].sessions[1].id, s1.id);
});

test('3. Daily total duration is aggregated correctly and formatted', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Physics' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Mechanics' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Statics' });

  // Session 1: 80 minutes
  const s1 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T08:00:00.000Z',
    endedAt: '2026-09-21T09:20:00.000Z',
  });

  // Session 2: 40 minutes
  const s2 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T10:40:00.000Z',
  });

  // Session 3: 40 minutes
  const s3 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T13:00:00.000Z',
    endedAt: '2026-09-21T13:40:00.000Z',
  });

  // English Gregorian
  const groupsEn = groupSessionsByDay([s1, s2, s3], {
    language: 'en',
    calendar: 'gregorian',
  });
  assert.equal(groupsEn[0].totalMinutes, 160); // 2h 40m
  assert.equal(groupsEn[0].formattedTotalTime, '2h 40m');

  // Persian Calendar & Language
  const groupsFa = groupSessionsByDay([s1, s2, s3], {
    language: 'fa',
    calendar: 'persian',
  });
  assert.equal(groupsFa[0].totalMinutes, 160);
  assert.equal(groupsFa[0].formattedTotalTime, '۲ ساعت و ۴۰ دقیقه');
});

test('4. Daily session count is calculated and formatted with localization', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Music' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Theory' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Scales' });

  const s1 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T08:00:00.000Z',
    endedAt: '2026-09-21T08:30:00.000Z',
  });
  const s2 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T09:00:00.000Z',
    endedAt: '2026-09-21T09:30:00.000Z',
  });
  const s3 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T11:00:00.000Z',
    endedAt: '2026-09-21T11:30:00.000Z',
  });

  // Multiple sessions (3 sessions / ۳ جلسه)
  const groupsEn = groupSessionsByDay([s1, s2, s3], { language: 'en', calendar: 'gregorian' });
  assert.equal(groupsEn[0].sessionCount, 3);
  assert.equal(groupsEn[0].formattedSessionCount, '3 sessions');

  const groupsFa = groupSessionsByDay([s1, s2, s3], { language: 'fa', calendar: 'persian' });
  assert.equal(groupsFa[0].sessionCount, 3);
  assert.equal(groupsFa[0].formattedSessionCount, '۳ جلسه');

  // Single session (1 session / ۱ جلسه)
  const singleGroupEn = groupSessionsByDay([s1], { language: 'en', calendar: 'gregorian' });
  assert.equal(singleGroupEn[0].sessionCount, 1);
  assert.equal(singleGroupEn[0].formattedSessionCount, '1 session');

  const singleGroupFa = groupSessionsByDay([s1], { language: 'fa', calendar: 'persian' });
  assert.equal(singleGroupFa[0].sessionCount, 1);
  assert.equal(singleGroupFa[0].formattedSessionCount, '۱ جلسه');
});

test('5. Different days remain separate and ordered newest-day-first', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Writing' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Novel' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Chapter 1' });

  // Day 1: Sep 19
  const s19 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-19T10:00:00.000Z',
    endedAt: '2026-09-19T11:00:00.000Z',
  });

  // Day 2: Sep 20
  const s20 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T11:00:00.000Z',
  });

  // Day 3: Sep 21
  const s21 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T11:00:00.000Z',
  });

  const groups = groupSessionsByDay([s19, s20, s21], {
    language: 'en',
    calendar: 'gregorian',
  });

  assert.equal(groups.length, 3);
  assert.equal(groups[0].dateKey, '2026-09-21');
  assert.equal(groups[1].dateKey, '2026-09-20');
  assert.equal(groups[2].dateKey, '2026-09-19');
});

test('6. Filtered results are grouped correctly without UI filter duplication', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Fullstack' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Core' });
  const taskTarget = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Target Task' });
  const taskOther = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Other Task' });

  await services.sessions.createManualSession({
    taskId: taskTarget.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T11:00:00.000Z',
  });
  await services.sessions.createManualSession({
    taskId: taskOther.id,
    startedAt: '2026-09-21T14:00:00.000Z',
    endedAt: '2026-09-21T15:00:00.000Z',
  });

  // Application layer handles filtering
  const queryResult = await services.sessions.querySessionHistory({ taskId: taskTarget.id });
  assert.equal(queryResult.totalSessions, 1);

  // Presentation layer groups the filtered result directly
  const groups = groupSessionsByDay(queryResult.sessions, {
    language: 'en',
    calendar: 'gregorian',
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].sessions.length, 1);
  assert.equal(groups[0].sessions[0].taskId, taskTarget.id);
});

test('7. Persian calendar grouping maps dates to Jalali calendar keys and names', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Solar Calendar' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Persian Epoch' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Jalali Math' });

  // 2026-09-21 is 30 Shahrivar 1405 (1405-06-30)
  const s1 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T11:00:00.000Z',
  });

  // 2026-09-22 is 31 Shahrivar 1405 (1405-06-31)
  const s2 = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-22T10:00:00.000Z',
    endedAt: '2026-09-22T11:00:00.000Z',
  });

  const groupsFa = groupSessionsByDay([s1, s2], {
    language: 'fa',
    calendar: 'persian',
  });

  assert.equal(groupsFa.length, 2);
  assert.equal(groupsFa[0].dateKey, '1405-06-31');
  assert.equal(groupsFa[0].formattedDate, '۳۱ شهریور ۱۴۰۵');
  assert.equal(groupsFa[1].dateKey, '1405-06-30');
  assert.equal(groupsFa[1].formattedDate, '۳۰ شهریور ۱۴۰۵');

  // English language + Persian calendar combination
  const groupsEnPersian = groupSessionsByDay([s1, s2], {
    language: 'en',
    calendar: 'persian',
  });
  assert.equal(groupsEnPersian[0].dateKey, '1405-06-31');
  assert.equal(groupsEnPersian[0].formattedDate, '31 Shahrivar 1405');
});

test('8. Gregorian calendar grouping maps dates to Gregorian keys and names', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Gregorian' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Standard' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Date Spec' });

  const session = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T11:00:00.000Z',
  });

  // English + Gregorian
  const groupsEn = groupSessionsByDay([session], {
    language: 'en',
    calendar: 'gregorian',
  });
  assert.equal(groupsEn[0].dateKey, '2026-09-21');
  assert.equal(groupsEn[0].formattedDate, 'September 21, 2026');

  // Persian + Gregorian
  const groupsFaGreg = groupSessionsByDay([session], {
    language: 'fa',
    calendar: 'gregorian',
  });
  assert.equal(groupsFaGreg[0].dateKey, '2026-09-21');
  assert.equal(groupsFaGreg[0].formattedDate, '۲۱ سپتامبر ۲۰۲۶');
});

test('9. Today / Yesterday relative labels: English and Persian while preserving exact calendar date', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Relative Days' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Calendar UX' });
  const task = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Labels' });

  // Fixed reference date: 2026-09-22 15:00:00Z (Today)
  const refDate = '2026-09-22T15:00:00.000Z';

  // Session on Today (2026-09-22)
  const sToday = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-22T10:00:00.000Z',
    endedAt: '2026-09-22T11:00:00.000Z',
  });

  // Session on Yesterday (2026-09-21)
  const sYesterday = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-21T14:00:00.000Z',
    endedAt: '2026-09-21T15:00:00.000Z',
  });

  // Session on Older day (2026-09-20)
  const sOlder = await services.sessions.createManualSession({
    taskId: task.id,
    startedAt: '2026-09-20T09:00:00.000Z',
    endedAt: '2026-09-20T10:00:00.000Z',
  });

  // English labels
  const groupsEn = groupSessionsByDay([sToday, sYesterday, sOlder], {
    language: 'en',
    calendar: 'gregorian',
  }, refDate);

  assert.equal(groupsEn[0].relativeLabel, 'Today');
  assert.equal(groupsEn[0].formattedDate, 'September 22, 2026'); // Exact date preserved!

  assert.equal(groupsEn[1].relativeLabel, 'Yesterday');
  assert.equal(groupsEn[1].formattedDate, 'September 21, 2026'); // Exact date preserved!

  assert.equal(groupsEn[2].relativeLabel, undefined);
  assert.equal(groupsEn[2].formattedDate, 'September 20, 2026');

  // Persian labels
  const groupsFa = groupSessionsByDay([sToday, sYesterday, sOlder], {
    language: 'fa',
    calendar: 'persian',
  }, refDate);

  assert.equal(groupsFa[0].relativeLabel, 'امروز');
  assert.equal(groupsFa[0].formattedDate, '۳۱ شهریور ۱۴۰۵'); // Exact date preserved!

  assert.equal(groupsFa[1].relativeLabel, 'دیروز');
  assert.equal(groupsFa[1].formattedDate, '۳۰ شهریور ۱۴۰۵'); // Exact date preserved!

  assert.equal(groupsFa[2].relativeLabel, undefined);
  assert.equal(groupsFa[2].formattedDate, '۲۹ شهریور ۱۴۰۵');
});

test('10. Existing session filtering behavior remains completely unchanged', async () => {
  const { services } = setupServices();

  const goal = await services.goals.createGoal({ title: 'Filter Invariants' });
  const roadmap = await services.roadmaps.createRoadmap({ goalId: goal.id, title: 'Invariants' });
  const taskA = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Task A' });
  const taskB = await services.tasks.createTask({ roadmapId: roadmap.id, title: 'Task B' });

  await services.sessions.createManualSession({
    taskId: taskA.id,
    startedAt: '2026-09-20T10:00:00.000Z',
    endedAt: '2026-09-20T11:00:00.000Z', // 60m
  });
  await services.sessions.createManualSession({
    taskId: taskB.id,
    startedAt: '2026-09-21T10:00:00.000Z',
    endedAt: '2026-09-21T11:30:00.000Z', // 90m
  });

  const queryResult = await services.sessions.querySessionHistory({
    startDate: '2026-09-21',
    endDate: '2026-09-21',
  });

  assert.equal(queryResult.totalSessions, 1);
  assert.equal(queryResult.totalMinutes, 90);
  assert.equal(queryResult.totalHoursAndMinutes.hours, 1);
  assert.equal(queryResult.totalHoursAndMinutes.minutes, 30);
  assert.equal(queryResult.sessions[0].taskId, taskB.id);

  // Pure presentation duration formatting is consistent
  assert.equal(formatDurationHoursMinutes(queryResult.totalMinutes, { language: 'en', calendar: 'gregorian' }), '1h 30m');
  assert.equal(formatDurationHoursMinutes(queryResult.totalMinutes, { language: 'fa', calendar: 'persian' }), '۱ ساعت و ۳۰ دقیقه');
});
