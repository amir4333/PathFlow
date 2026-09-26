/**
 * Backend Teacher Service
 *
 * Enforces student-controlled grants and read-only data access for teachers/mentors.
 * Completely prohibits write operations on student records.
 */

import { DatabaseStore, BackendTeacherAccessGrant } from '../db/types';

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

    const token = `pt_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;

    const permissions = options.permissions && options.permissions.length > 0
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

  // --- Read-Only Query Methods ---

  async getStudentGoals(token: string, studentId: string) {
    await this.verifyAccess(token, studentId, 'read:goals');
    return this.store.getGoals(studentId);
  }

  async getStudentRoadmaps(token: string, studentId: string) {
    await this.verifyAccess(token, studentId, 'read:roadmaps');
    return this.store.getRoadmaps(studentId);
  }

  async getStudentTasks(token: string, studentId: string) {
    await this.verifyAccess(token, studentId, 'read:tasks');
    return this.store.getTasks(studentId);
  }

  async getStudentSessions(token: string, studentId: string, startDate?: string, endDate?: string) {
    await this.verifyAccess(token, studentId, 'read:sessions');
    const sessions = await this.store.getSessions(studentId);
    return sessions.filter((s) => {
      if (startDate && s.startedAt < startDate) return false;
      if (endDate && s.startedAt > endDate) return false;
      return true;
    });
  }

  async getStudentWeeklyPlans(token: string, studentId: string) {
    await this.verifyAccess(token, studentId, 'read:weekly_plans');
    const [plans, items] = await Promise.all([
      this.store.getWeeklyPlans(studentId),
      this.store.getWeeklyPlanItems(studentId),
    ]);

    return plans.map((plan) => ({
      ...plan,
      items: items.filter((i) => i.weeklyPlanId === plan.id),
    }));
  }

  async getStudentProgress(token: string, studentId: string) {
    // Requires goals or reports permission
    try {
      await this.verifyAccess(token, studentId, 'read:goals');
    } catch {
      await this.verifyAccess(token, studentId, 'read:reports');
    }

    const [goals, roadmaps, tasks, sessions] = await Promise.all([
      this.store.getGoals(studentId),
      this.store.getRoadmaps(studentId),
      this.store.getTasks(studentId),
      this.store.getSessions(studentId),
    ]);

    const totalEstimatedMinutes = tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
    const totalActualMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;

    return {
      studentId,
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
    await this.verifyAccess(token, studentId, 'read:reports');
    const [goals, roadmaps, tasks, sessions, weeklyPlans] = await Promise.all([
      this.store.getGoals(studentId),
      this.store.getRoadmaps(studentId),
      this.store.getTasks(studentId),
      this.store.getSessions(studentId),
      this.store.getWeeklyPlans(studentId),
    ]);

    return {
      studentId,
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
