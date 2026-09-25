import test from 'node:test';
import assert from 'node:assert/strict';
import { TeacherAccessManager } from '../../src/sync';
import { TeacherRemoteAdapter, TeacherPermissionError, TeacherDataProvider } from '../../src/data';
import {
  generateEntityId,
  createGoal,
  createRoadmap,
  createTask,
  createSession,
  Goal,
  Roadmap,
  Task,
  Session,
  WeeklyPlan,
} from '../../src/domain';

function createMockDataProvider(data?: {
  goals?: Goal[];
  roadmaps?: Roadmap[];
  tasks?: Task[];
  sessions?: Session[];
  weeklyPlans?: WeeklyPlan[];
}): TeacherDataProvider {
  return {
    getGoals: async () => data?.goals ?? [],
    getRoadmaps: async () => data?.roadmaps ?? [],
    getTasks: async () => data?.tasks ?? [],
    getSessions: async () => data?.sessions ?? [],
    getWeeklyPlans: async () => data?.weeklyPlans ?? [],
  };
}

test('TeacherAccessManager: Issue, validate, and revoke read-only teacher grants', () => {
  const manager = new TeacherAccessManager();
  const studentId = generateEntityId();

  // Create grant
  const grant = manager.createGrant({
    studentId,
    label: 'Mentor Prof. Turing',
    permissions: ['read:goals', 'read:roadmaps', 'read:tasks', 'read:sessions', 'read:weekly_plans'],
    ttlDays: 30,
  });

  assert.equal(grant.studentId, studentId);
  assert.equal(grant.role, 'read_only');
  assert.equal(grant.isActive, true);
  assert.ok(grant.token.startsWith('pt_'));
  assert.ok(grant.expiresAt);

  // Validate active token
  const validCheck = manager.validateToken(grant.token);
  assert.equal(validCheck.isValid, true);
  assert.equal(validCheck.grant?.id, grant.id);

  // Student revokes grant
  const revoked = manager.revokeGrant(grant.id);
  assert.equal(revoked.isActive, false);
  assert.ok(revoked.revokedAt);

  // Validate after revocation -> rejected
  const revokedCheck = manager.validateToken(grant.token);
  assert.equal(revokedCheck.isValid, false);
  assert.ok(revokedCheck.error?.includes('revoked'));
});

test('TeacherRemoteAdapter: Allows authorized read queries and enforces data access', async () => {
  const manager = new TeacherAccessManager();
  const studentId = generateEntityId();

  const grant = manager.createGrant({
    studentId,
    label: 'Thesis Advisor',
  });

  const testGoal = createGoal({ title: 'Thesis Defense' });
  const testRoadmap = createRoadmap({ goalId: testGoal.id, title: 'Chapter 1' });
  const testTask = createTask({ roadmapId: testRoadmap.id, title: 'Literature Review' });

  const provider = createMockDataProvider({
    goals: [testGoal],
    roadmaps: [testRoadmap],
    tasks: [testTask],
  });

  const adapter = new TeacherRemoteAdapter(grant, provider);

  const goals = await adapter.listGoals();
  assert.equal(goals.length, 1);
  assert.equal(goals[0].title, 'Thesis Defense');

  const fetchedGoal = await adapter.getGoalById(testGoal.id);
  assert.equal(fetchedGoal?.id, testGoal.id);

  const tasks = await adapter.listTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'Literature Review');
});

test('TeacherRemoteAdapter: Rejects ANY write or mutation operation with TeacherPermissionError', async () => {
  const manager = new TeacherAccessManager();
  const grant = manager.createGrant({
    studentId: generateEntityId(),
    label: 'Auditor',
  });

  const provider = createMockDataProvider();
  const adapter = new TeacherRemoteAdapter(grant, provider);

  // Assert all mutation attempts throw TeacherPermissionError
  await assert.rejects(
    async () => {
      await adapter.createGoal();
    },
    (err: any) => err instanceof TeacherPermissionError
  );

  await assert.rejects(
    async () => {
      await adapter.updateGoal();
    },
    (err: any) => err instanceof TeacherPermissionError
  );

  await assert.rejects(
    async () => {
      await adapter.deleteGoal();
    },
    (err: any) => err instanceof TeacherPermissionError
  );

  await assert.rejects(
    async () => {
      await adapter.createTask();
    },
    (err: any) => err instanceof TeacherPermissionError
  );

  await assert.rejects(
    async () => {
      await adapter.deleteSession();
    },
    (err: any) => err instanceof TeacherPermissionError
  );
});

test('TeacherRemoteAdapter: Enforces granular permission scoping', async () => {
  const manager = new TeacherAccessManager();
  // Grant that only has read:goals, missing read:tasks
  const restrictedGrant = manager.createGrant({
    studentId: generateEntityId(),
    label: 'High-Level Reviewer',
    permissions: ['read:goals'],
  });

  const provider = createMockDataProvider();
  const adapter = new TeacherRemoteAdapter(restrictedGrant, provider);

  // Allowed
  const goals = await adapter.listGoals();
  assert.deepEqual(goals, []);

  // Prohibited due to missing read:tasks permission
  await assert.rejects(
    async () => {
      await adapter.listTasks();
    },
    (err: any) => err instanceof TeacherPermissionError && err.message.includes('read:tasks')
  );
});
