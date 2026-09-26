/**
 * Backend Teacher Service
 *
 * Enforces student-controlled grants and read-only data access for teachers/mentors.
 * Completely prohibits write operations on student records and enforces granular
 * grant scope boundaries (all, goal, roadmap).
 */

import {
  DatabaseStore,
  BackendTeacherAccessGrant,
  BackendTeacherGrantScopeType,
} from '../db/types';

export class TeacherAccessError extends Error {
  constructor(message: string, public readonly statusCode = 403) {
    super(message);
    this.name = 'TeacherAccessError';
  }
}

export class TeacherService {
  constructor(private readonly store: DatabaseStore) {}

  // --- Student Grant Management ---

  async createGrant(
    studentId: string,
    options: {
      label: string;
      permissions?: string[];
      scopeType?: BackendTeacherGrantScopeType;
      scopeId?: string | null;
      ttlDays?: number;
    }
  ): Promise<BackendTeacherAccessGrant> {
    const now = new Date();
    let expiresAt: string | null = null;

    if (options.ttlDays && options.ttlDays > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + options.ttlDays);
      expiresAt = expDate.toISOString();
    }

    const scopeType = options.scopeType ?? 'all';
    const scopeId = options.scopeId?.trim() || null;

    // Validate scope targets
    if (scopeType === 'goal') {
      if (!scopeId) {
        throw new TeacherAccessError('scopeId is required when scopeType is "goal"', 400);
      }
      const goals = await this.store.getGoals(studentId);
      if (!goals.some((g) => g.id === scopeId)) {
        throw new TeacherAccessError('Scoped goal not found or not owned by student', 404);
      }
    } else if (scopeType === 'roadmap') {
      if (!scopeId) {
        throw new TeacherAccessError('scopeId is required when scopeType is "roadmap"', 400);
      }
      const roadmaps = await this.store.getRoadmaps(studentId);
      if (!roadmaps.some((r) => r.id === scopeId)) {
        throw new TeacherAccessError('Scoped roadmap not found or not owned by student', 404);
      }
    }

    const token = `pt_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;

    const permissions =
      options.permissions && options.permissions.length > 0
        ? options.permissions
        : [
            'read:goals',
            'read:roadmaps',
            'read:tasks',
            'read:sessions',
            'read:weekly_plans',
            'read:reports',
          ];

    return this.store.createTeacherGrant({
      studentId,
      label: options.label.trim(),
      token,
      role: 'read_only',
      permissions,
      scopeType,
      scopeId,
      createdAt: now.toISOString(),
      expiresAt,
      isActive: true,
    });
  }

  async listGrants(studentId: string): Promise<BackendTeacherAccessGrant[]> {
    return this.store.getTeacherGrantsForStudent(studentId);
  }

  async revokeGrant(studentId: string, grantId: string): Promise<BackendTeacherAccessGrant> {
    const grant = await this.store.getTeacherGrantById(grantId);
    if (!grant || grant.studentId !== studentId) {
      throw new TeacherAccessError('Grant not found or not owned by student', 404);
    }
    return this.store.revokeTeacherGrant(grantId);
  }

  // --- Teacher Grant Verification ---

  async verifyAccess(
    token: string,
    studentId: string,
    requiredPermission: string
  ): Promise<BackendTeacherAccessGrant> {
    if (!token || token.trim().length === 0) {
      throw new TeacherAccessError('Missing teacher access token', 401);
    }

    const grant = await this.store.getTeacherGrantByToken(token);
    if (!grant) {
      throw new TeacherAccessError('Invalid or unknown teacher access token', 403);
    }

    if (grant.studentId !== studentId) {
      throw new TeacherAccessError('Access token is not authorized for this student', 403);
    }

    if (!grant.isActive) {
      throw new TeacherAccessError('Teacher access grant has been revoked by the student', 403);
    }

    if (grant.expiresAt) {
      const expMs = Date.parse(grant.expiresAt);
      if (!isNaN(expMs) && Date.now() > expMs) {
        throw new TeacherAccessError('Teacher access grant has expired', 403);
      }
    }

    if (!grant.permissions.includes(requiredPermission)) {
      throw new TeacherAccessError(
        `Teacher grant is missing required permission: "${requiredPermission}"`,
        403
      );
    }

    return grant;
  }

  // --- Read-Only Query Methods (With Granular Grant Scoping) ---

  async getStudentGoals(token: string, studentId: string) {
    const grant = await this.verifyAccess(token, studentId, 'read:goals');
    const goals = await this.store.getGoals(studentId);

    if (grant.scopeType === 'goal' && grant.scopeId) {
      return goals.filter((g) => g.id === grant.scopeId);
    }
    if (grant.scopeType === 'roadmap' && grant.scopeId) {
      const roadmaps = await this.store.getRoadmaps(studentId);
      const targetRoadmap = roadmaps.find((r) => r.id === grant.scopeId);
      if (!targetRoadmap) return [];
      return goals.filter((g) => g.id === targetRoadmap.goalId);
    }
    return goals;
  }

  async getStudentRoadmaps(token: string, studentId: string) {
    const grant = await this.verifyAccess(token, studentId, 'read:roadmaps');
    const roadmaps = await this.store.getRoadmaps(studentId);

    if (grant.scopeType === 'goal' && grant.scopeId) {
      return roadmaps.filter((r) => r.goalId === grant.scopeId);
    }
    if (grant.scopeType === 'roadmap' && grant.scopeId) {
      return roadmaps.filter((r) => r.id === grant.scopeId);
    }
    return roadmaps;
  }

  async getStudentTasks(token: string, studentId: string) {
    const grant = await this.verifyAccess(token, studentId, 'read:tasks');
    const tasks = await this.store.getTasks(studentId);

    if (grant.scopeType === 'goal' && grant.scopeId) {
      const roadmaps = await this.store.getRoadmaps(studentId);
      const allowedRoadmapIds = new Set(
        roadmaps.filter((r) => r.goalId === grant.scopeId).map((r) => r.id)
      );
      return tasks.filter((t) => allowedRoadmapIds.has(t.roadmapId));
    }
    if (grant.scopeType === 'roadmap' && grant.scopeId) {
      return tasks.filter((t) => t.roadmapId === grant.scopeId);
    }
    return tasks;
  }

  async getStudentSessions(token: string, studentId: string, startDate?: string, endDate?: string) {
    const grant = await this.verifyAccess(token, studentId, 'read:sessions');
    let sessions = await this.store.getSessions(studentId);

    if (grant.scopeType === 'goal' && grant.scopeId) {
      const roadmaps = await this.store.getRoadmaps(studentId);
      const allowedRoadmapIds = new Set(
        roadmaps.filter((r) => r.goalId === grant.scopeId).map((r) => r.id)
      );
      const tasks = await this.store.getTasks(studentId);
      const allowedTaskIds = new Set(
        tasks.filter((t) => allowedRoadmapIds.has(t.roadmapId)).map((t) => t.id)
      );
      sessions = sessions.filter((s) => allowedTaskIds.has(s.taskId));
    } else if (grant.scopeType === 'roadmap' && grant.scopeId) {
      const tasks = await this.store.getTasks(studentId);
      const allowedTaskIds = new Set(
        tasks.filter((t) => t.roadmapId === grant.scopeId).map((t) => t.id)
      );
      sessions = sessions.filter((s) => allowedTaskIds.has(s.taskId));
    }

    return sessions.filter((s) => {
      if (startDate && s.startedAt < startDate) return false;
      if (endDate && s.startedAt > endDate) return false;
      return true;
    });
  }

  async getStudentWeeklyPlans(token: string, studentId: string) {
    const grant = await this.verifyAccess(token, studentId, 'read:weekly_plans');
    const [plans, items] = await Promise.all([
      this.store.getWeeklyPlans(studentId),
      this.store.getWeeklyPlanItems(studentId),
    ]);

    let allowedTaskIds: Set<string> | null = null;
    if (grant.scopeType === 'goal' && grant.scopeId) {
      const roadmaps = await this.store.getRoadmaps(studentId);
      const allowedRoadmapIds = new Set(
        roadmaps.filter((r) => r.goalId === grant.scopeId).map((r) => r.id)
      );
      const tasks = await this.store.getTasks(studentId);
      allowedTaskIds = new Set(
        tasks.filter((t) => allowedRoadmapIds.has(t.roadmapId)).map((t) => t.id)
      );
    } else if (grant.scopeType === 'roadmap' && grant.scopeId) {
      const tasks = await this.store.getTasks(studentId);
      allowedTaskIds = new Set(
        tasks.filter((t) => t.roadmapId === grant.scopeId).map((t) => t.id)
      );
    }

    return plans.map((plan) => {
      const planItems = items.filter(
        (i) => i.weeklyPlanId === plan.id && (!allowedTaskIds || allowedTaskIds.has(i.taskId))
      );
      return {
        ...plan,
        items: planItems,
      };
    });
  }

  async getStudentProgress(token: string, studentId: string) {
    // Requires goals or reports permission
    let grant: BackendTeacherAccessGrant;
    try {
      grant = await this.verifyAccess(token, studentId, 'read:goals');
    } catch {
      grant = await this.verifyAccess(token, studentId, 'read:reports');
    }

    const [goals, roadmaps, tasks, sessions] = await Promise.all([
      grant.permissions.includes('read:goals') ? this.getStudentGoals(token, studentId) : Promise.resolve([]),
      grant.permissions.includes('read:roadmaps') ? this.getStudentRoadmaps(token, studentId) : Promise.resolve([]),
      grant.permissions.includes('read:tasks') ? this.getStudentTasks(token, studentId) : Promise.resolve([]),
      grant.permissions.includes('read:sessions') ? this.getStudentSessions(token, studentId) : Promise.resolve([]),
    ]);

    const totalEstimatedMinutes = tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
    const totalActualMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;

    return {
      studentId,
      scopeType: grant.scopeType ?? 'all',
      scopeId: grant.scopeId ?? null,
      totalGoals: goals.length,
      totalRoadmaps: roadmaps.length,
      totalTasks: tasks.length,
      completedTasks,
      totalSessions: sessions.length,
      totalEstimatedMinutes,
      totalActualMinutes,
    };
  }

  async getStudentReports(token: string, studentId: string) {
    const grant = await this.verifyAccess(token, studentId, 'read:reports');
    const [goals, roadmaps, tasks, sessions, weeklyPlans] = await Promise.all([
      grant.permissions.includes('read:goals') ? this.getStudentGoals(token, studentId) : Promise.resolve([]),
      grant.permissions.includes('read:roadmaps') ? this.getStudentRoadmaps(token, studentId) : Promise.resolve([]),
      grant.permissions.includes('read:tasks') ? this.getStudentTasks(token, studentId) : Promise.resolve([]),
      grant.permissions.includes('read:sessions') ? this.getStudentSessions(token, studentId) : Promise.resolve([]),
      grant.permissions.includes('read:weekly_plans') ? this.getStudentWeeklyPlans(token, studentId) : Promise.resolve([]),
    ]);

    return {
      studentId,
      scopeType: grant.scopeType ?? 'all',
      scopeId: grant.scopeId ?? null,
      generatedAt: new Date().toISOString(),
      overview: {
        totalGoals: goals.length,
        totalRoadmaps: roadmaps.length,
        totalTasks: tasks.length,
        totalSessions: sessions.length,
        totalWeeklyPlans: weeklyPlans.length,
      },
      goals,
      roadmaps,
      tasks,
      sessions,
      weeklyPlans,
    };
  }
}
