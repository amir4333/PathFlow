/**
 * Teacher Remote Read-Only Adapter
 *
 * Enforces the architectural boundary that Teacher access is strictly read-only.
 * All write, update, and delete invocations are rejected at compile-time and runtime.
 */

import { Goal, Roadmap, Task, Session, WeeklyPlan, EntityId } from '../../domain';
import { TeacherAccessGrant } from '../../sync/types';

export class TeacherPermissionError extends Error {
  constructor(message: string = 'Teacher access is strictly read-only. Mutation operations are prohibited.') {
    super(message);
    this.name = 'TeacherPermissionError';
  }
}

export interface TeacherDataProvider {
  getGoals(): Promise<Goal[]>;
  getRoadmaps(): Promise<Roadmap[]>;
  getTasks(): Promise<Task[]>;
  getSessions(): Promise<Session[]>;
  getWeeklyPlans(): Promise<WeeklyPlan[]>;
}

export class TeacherRemoteAdapter {
  private readonly grant: TeacherAccessGrant;
  private readonly provider: TeacherDataProvider;

  constructor(grant: TeacherAccessGrant, provider: TeacherDataProvider) {
    if (grant.role !== 'read_only') {
      throw new TeacherPermissionError('Invalid grant: role must be read_only');
    }
    if (!grant.isActive) {
      throw new TeacherPermissionError('Grant is inactive or revoked');
    }

    this.grant = grant;
    this.provider = provider;
  }

  // --- Authorized Read-Only Queries ---

  async listGoals(): Promise<Goal[]> {
    this.assertPermission('read:goals');
    return this.provider.getGoals();
  }

  async getGoalById(id: EntityId): Promise<Goal | null> {
    this.assertPermission('read:goals');
    const goals = await this.provider.getGoals();
    return goals.find((g) => g.id === id) ?? null;
  }

  async listRoadmaps(): Promise<Roadmap[]> {
    this.assertPermission('read:roadmaps');
    return this.provider.getRoadmaps();
  }

  async getRoadmapById(id: EntityId): Promise<Roadmap | null> {
    this.assertPermission('read:roadmaps');
    const roadmaps = await this.provider.getRoadmaps();
    return roadmaps.find((r) => r.id === id) ?? null;
  }

  async listTasks(): Promise<Task[]> {
    this.assertPermission('read:tasks');
    return this.provider.getTasks();
  }

  async getTaskById(id: EntityId): Promise<Task | null> {
    this.assertPermission('read:tasks');
    const tasks = await this.provider.getTasks();
    return tasks.find((t) => t.id === id) ?? null;
  }

  async querySessions(startDate?: string, endDate?: string): Promise<Session[]> {
    this.assertPermission('read:sessions');
    const sessions = await this.provider.getSessions();
    return sessions.filter((s) => {
      if (startDate && s.startedAt < startDate) return false;
      if (endDate && s.startedAt > endDate) return false;
      return true;
    });
  }

  async getWeeklyPlan(weekIdentifier: string): Promise<WeeklyPlan | null> {
    this.assertPermission('read:weekly_plans');
    const plans = await this.provider.getWeeklyPlans();
    return plans.find((p) => p.weekIdentifier === weekIdentifier) ?? null;
  }

  // --- Strict Mutation Prohibition Enforcers ---

  async createGoal(): Promise<never> {
    throw new TeacherPermissionError();
  }

  async updateGoal(): Promise<never> {
    throw new TeacherPermissionError();
  }

  async deleteGoal(): Promise<never> {
    throw new TeacherPermissionError();
  }

  async createTask(): Promise<never> {
    throw new TeacherPermissionError();
  }

  async updateTask(): Promise<never> {
    throw new TeacherPermissionError();
  }

  async deleteTask(): Promise<never> {
    throw new TeacherPermissionError();
  }

  async createSession(): Promise<never> {
    throw new TeacherPermissionError();
  }

  async deleteSession(): Promise<never> {
    throw new TeacherPermissionError();
  }

  private assertPermission(permission: typeof this.grant.permissions[number]): void {
    if (!this.grant.permissions.includes(permission)) {
      throw new TeacherPermissionError(`Access denied: Missing required permission "${permission}"`);
    }
  }
}
