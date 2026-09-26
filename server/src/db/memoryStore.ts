/**
 * In-Memory Database Store
 *
 * Implements DatabaseStore with pure in-memory data structures.
 * Allows lightning-fast, isolated, deterministic automated testing.
 */

import {
  BackendUser,
  BackendGoal,
  BackendRoadmap,
  BackendTask,
  BackendSession,
  BackendWeeklyPlan,
  BackendWeeklyPlanItem,
  BackendSyncMutation,
  BackendTombstone,
  BackendTeacherAccessGrant,
  DatabaseStore,
} from './types';

let nextId = 1;
function genId(prefix = 'id'): string {
  return `${prefix}-${nextId++}-${Math.random().toString(36).substring(2, 9)}`;
}

export class MemoryDatabaseStore implements DatabaseStore {
  private users: Map<string, BackendUser> = new Map();
  private goals: Map<string, BackendGoal> = new Map();
  private roadmaps: Map<string, BackendRoadmap> = new Map();
  private tasks: Map<string, BackendTask> = new Map();
  private sessions: Map<string, BackendSession> = new Map();
  private weeklyPlans: Map<string, BackendWeeklyPlan> = new Map();
  private weeklyPlanItems: Map<string, BackendWeeklyPlanItem> = new Map();
  private mutations: BackendSyncMutation[] = [];
  private tombstones: BackendTombstone[] = [];
  private grants: Map<string, BackendTeacherAccessGrant> = new Map();
  private globalSequence = 1;

  async createUser(userData: Omit<BackendUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<BackendUser> {
    const now = new Date();
    const user: BackendUser = {
      id: genId('usr'),
      ...userData,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUserByEmail(email: string): Promise<BackendUser | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  async getUserById(id: string): Promise<BackendUser | null> {
    return this.users.get(id) ?? null;
  }

  // --- Sync Mutations & Idempotency ---

  async findMutationByClientKey(
    studentId: string,
    deviceId: string,
    clientMutationId: string
  ): Promise<BackendSyncMutation | null> {
    const found = this.mutations.find(
      (m) =>
        m.studentId === studentId &&
        m.deviceId === deviceId &&
        m.clientMutationId === clientMutationId
    );
    return found ?? null;
  }

  async recordMutation(
    mutationData: Omit<BackendSyncMutation, 'id' | 'sequence' | 'createdAt'>
  ): Promise<BackendSyncMutation> {
    const mutation: BackendSyncMutation = {
      id: genId('mut'),
      sequence: this.globalSequence++,
      createdAt: new Date(),
      ...mutationData,
    };
    this.mutations.push(mutation);
    return mutation;
  }

  async getMutationsAfter(
    studentId: string,
    timestampOrSequence: string | number,
    limit = 100
  ): Promise<BackendSyncMutation[]> {
    return this.mutations
      .filter((m) => {
        if (m.studentId !== studentId) return false;
        if (typeof timestampOrSequence === 'number') {
          return m.sequence > timestampOrSequence;
        }
        return m.timestamp > timestampOrSequence;
      })
      .slice(0, limit);
  }

  async getMaxSequence(studentId: string): Promise<number> {
    const userMutations = this.mutations.filter((m) => m.studentId === studentId);
    if (userMutations.length === 0) return 0;
    return Math.max(...userMutations.map((m) => m.sequence));
  }

  // --- Tombstones ---

  async recordTombstone(
    tombstoneData: Omit<BackendTombstone, 'id' | 'sequence' | 'createdAt'>
  ): Promise<BackendTombstone> {
    const existingIdx = this.tombstones.findIndex(
      (t) =>
        t.studentId === tombstoneData.studentId &&
        t.entityType === tombstoneData.entityType &&
        t.entityId === tombstoneData.entityId
    );

    const tombstone: BackendTombstone = {
      id: genId('tmb'),
      sequence: this.globalSequence++,
      createdAt: new Date(),
      ...tombstoneData,
    };

    if (existingIdx >= 0) {
      this.tombstones[existingIdx] = tombstone;
    } else {
      this.tombstones.push(tombstone);
    }

    return tombstone;
  }

  async getTombstonesAfter(
    studentId: string,
    timestampOrSequence: string | number
  ): Promise<BackendTombstone[]> {
    return this.tombstones.filter((t) => {
      if (t.studentId !== studentId) return false;
      if (typeof timestampOrSequence === 'number') {
        return t.sequence > timestampOrSequence;
      }
      return t.deletedAt > timestampOrSequence;
    });
  }

  // --- Entity Operations (With Strict Student Ownership Enforcement) ---

  async upsertGoal(goal: BackendGoal): Promise<BackendGoal> {
    const existing = this.goals.get(goal.id);
    if (existing && existing.studentId !== goal.studentId) {
      throw new Error(`Unauthorized cross-student access: Goal ${goal.id} belongs to another student`);
    }
    this.goals.set(goal.id, goal);
    return goal;
  }

  async deleteGoal(studentId: string, id: string): Promise<void> {
    const goal = this.goals.get(id);
    if (goal) {
      if (goal.studentId !== studentId) {
        throw new Error(`Unauthorized cross-student deletion: Goal ${id} belongs to another student`);
      }
      this.goals.delete(id);
    }
  }

  async getGoals(studentId: string): Promise<BackendGoal[]> {
    return Array.from(this.goals.values()).filter((g) => g.studentId === studentId);
  }

  async upsertRoadmap(roadmap: BackendRoadmap): Promise<BackendRoadmap> {
    const existing = this.roadmaps.get(roadmap.id);
    if (existing && existing.studentId !== roadmap.studentId) {
      throw new Error(`Unauthorized cross-student access: Roadmap ${roadmap.id} belongs to another student`);
    }
    const parentGoal = this.goals.get(roadmap.goalId);
    if (parentGoal && parentGoal.studentId !== roadmap.studentId) {
      throw new Error(`Unauthorized cross-student reference: Goal ${roadmap.goalId} belongs to another student`);
    }
    this.roadmaps.set(roadmap.id, roadmap);
    return roadmap;
  }

  async deleteRoadmap(studentId: string, id: string): Promise<void> {
    const roadmap = this.roadmaps.get(id);
    if (roadmap) {
      if (roadmap.studentId !== studentId) {
        throw new Error(`Unauthorized cross-student deletion: Roadmap ${id} belongs to another student`);
      }
      this.roadmaps.delete(id);
    }
  }

  async getRoadmaps(studentId: string): Promise<BackendRoadmap[]> {
    return Array.from(this.roadmaps.values()).filter((r) => r.studentId === studentId);
  }

  async upsertTask(task: BackendTask): Promise<BackendTask> {
    const existing = this.tasks.get(task.id);
    if (existing && existing.studentId !== task.studentId) {
      throw new Error(`Unauthorized cross-student access: Task ${task.id} belongs to another student`);
    }
    const parentRoadmap = this.roadmaps.get(task.roadmapId);
    if (parentRoadmap && parentRoadmap.studentId !== task.studentId) {
      throw new Error(`Unauthorized cross-student reference: Roadmap ${task.roadmapId} belongs to another student`);
    }
    this.tasks.set(task.id, task);
    return task;
  }

  async deleteTask(studentId: string, id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      if (task.studentId !== studentId) {
        throw new Error(`Unauthorized cross-student deletion: Task ${id} belongs to another student`);
      }
      this.tasks.delete(id);
    }
  }

  async getTasks(studentId: string): Promise<BackendTask[]> {
    return Array.from(this.tasks.values()).filter((t) => t.studentId === studentId);
  }

  async upsertSession(session: BackendSession): Promise<BackendSession> {
    const existing = this.sessions.get(session.id);
    if (existing && existing.studentId !== session.studentId) {
      throw new Error(`Unauthorized cross-student access: Session ${session.id} belongs to another student`);
    }
    const parentTask = this.tasks.get(session.taskId);
    if (parentTask && parentTask.studentId !== session.studentId) {
      throw new Error(`Unauthorized cross-student reference: Task ${session.taskId} belongs to another student`);
    }
    this.sessions.set(session.id, session);
    return session;
  }

  async deleteSession(studentId: string, id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      if (session.studentId !== studentId) {
        throw new Error(`Unauthorized cross-student deletion: Session ${id} belongs to another student`);
      }
      this.sessions.delete(id);
    }
  }

  async getSessions(studentId: string): Promise<BackendSession[]> {
    return Array.from(this.sessions.values()).filter((s) => s.studentId === studentId);
  }

  async upsertWeeklyPlan(plan: BackendWeeklyPlan): Promise<BackendWeeklyPlan> {
    const existing = this.weeklyPlans.get(plan.id);
    if (existing && existing.studentId !== plan.studentId) {
      throw new Error(`Unauthorized cross-student access: WeeklyPlan ${plan.id} belongs to another student`);
    }
    this.weeklyPlans.set(plan.id, plan);
    return plan;
  }

  async deleteWeeklyPlan(studentId: string, id: string): Promise<void> {
    const plan = this.weeklyPlans.get(id);
    if (plan) {
      if (plan.studentId !== studentId) {
        throw new Error(`Unauthorized cross-student deletion: WeeklyPlan ${id} belongs to another student`);
      }
      this.weeklyPlans.delete(id);
    }
  }

  async getWeeklyPlans(studentId: string): Promise<BackendWeeklyPlan[]> {
    return Array.from(this.weeklyPlans.values()).filter((p) => p.studentId === studentId);
  }

  async upsertWeeklyPlanItem(item: BackendWeeklyPlanItem): Promise<BackendWeeklyPlanItem> {
    const existing = this.weeklyPlanItems.get(item.id);
    if (existing && existing.studentId !== item.studentId) {
      throw new Error(`Unauthorized cross-student access: WeeklyPlanItem ${item.id} belongs to another student`);
    }
    this.weeklyPlanItems.set(item.id, item);
    return item;
  }

  async deleteWeeklyPlanItem(studentId: string, id: string): Promise<void> {
    const item = this.weeklyPlanItems.get(id);
    if (item) {
      if (item.studentId !== studentId) {
        throw new Error(`Unauthorized cross-student deletion: WeeklyPlanItem ${id} belongs to another student`);
      }
      this.weeklyPlanItems.delete(id);
    }
  }

  async getWeeklyPlanItems(studentId: string): Promise<BackendWeeklyPlanItem[]> {
    return Array.from(this.weeklyPlanItems.values()).filter((i) => i.studentId === studentId);
  }

  // --- Teacher Grants ---

  async createTeacherGrant(
    grantData: Omit<BackendTeacherAccessGrant, 'id'>
  ): Promise<BackendTeacherAccessGrant> {
    const grant: BackendTeacherAccessGrant = {
      id: genId('grnt'),
      scopeType: grantData.scopeType ?? 'all',
      scopeId: grantData.scopeId ?? null,
      ...grantData,
    };
    this.grants.set(grant.id, grant);
    return grant;
  }

  async getTeacherGrantById(id: string): Promise<BackendTeacherAccessGrant | null> {
    return this.grants.get(id) ?? null;
  }

  async getTeacherGrantByToken(token: string): Promise<BackendTeacherAccessGrant | null> {
    for (const g of this.grants.values()) {
      if (g.token === token) return g;
    }
    return null;
  }

  async getTeacherGrantsForStudent(studentId: string): Promise<BackendTeacherAccessGrant[]> {
    return Array.from(this.grants.values()).filter((g) => g.studentId === studentId);
  }

  async revokeTeacherGrant(id: string): Promise<BackendTeacherAccessGrant> {
    const grant = this.grants.get(id);
    if (!grant) {
      throw new Error(`Teacher grant not found: ${id}`);
    }
    const updated: BackendTeacherAccessGrant = {
      ...grant,
      isActive: false,
      revokedAt: new Date().toISOString(),
    };
    this.grants.set(id, updated);
    return updated;
  }

  clear(): void {
    this.users.clear();
    this.goals.clear();
    this.roadmaps.clear();
    this.tasks.clear();
    this.sessions.clear();
    this.weeklyPlans.clear();
    this.weeklyPlanItems.clear();
    this.mutations = [];
    this.tombstones = [];
    this.grants.clear();
  }
}
