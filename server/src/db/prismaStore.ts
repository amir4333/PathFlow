/**
 * Prisma Database Store
 *
 * PostgreSQL implementation of DatabaseStore backed by Prisma ORM.
 */

import { PrismaClient } from '@prisma/client';
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

export class PrismaDatabaseStore implements DatabaseStore {
  constructor(private readonly prisma: PrismaClient) {}

  async createUser(userData: Omit<BackendUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<BackendUser> {
    const user = await this.prisma.user.create({
      data: {
        email: userData.email,
        passwordHash: userData.passwordHash,
        role: userData.role,
      },
    });
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role as 'student' | 'teacher',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getUserByEmail(email: string): Promise<BackendUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role as 'student' | 'teacher',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getUserById(id: string): Promise<BackendUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role as 'student' | 'teacher',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // --- Sync Mutations & Idempotency ---

  async findMutationByClientKey(
    studentId: string,
    deviceId: string,
    clientMutationId: string
  ): Promise<BackendSyncMutation | null> {
    const record = await this.prisma.syncMutationRecord.findUnique({
      where: {
        studentId_deviceId_clientMutationId: {
          studentId,
          deviceId,
          clientMutationId,
        },
      },
    });
    if (!record) return null;
    return {
      id: record.id,
      studentId: record.studentId,
      deviceId: record.deviceId,
      clientMutationId: record.clientMutationId,
      sequence: record.sequence,
      entityType: record.entityType,
      entityId: record.entityId,
      operation: record.operation,
      payload: record.payload,
      timestamp: record.timestamp,
      createdAt: record.createdAt,
    };
  }

  async recordMutation(
    mutationData: Omit<BackendSyncMutation, 'id' | 'sequence' | 'createdAt'>
  ): Promise<BackendSyncMutation> {
    const record = await this.prisma.syncMutationRecord.create({
      data: {
        studentId: mutationData.studentId,
        deviceId: mutationData.deviceId,
        clientMutationId: mutationData.clientMutationId,
        entityType: mutationData.entityType,
        entityId: mutationData.entityId,
        operation: mutationData.operation,
        payload: mutationData.payload,
        timestamp: mutationData.timestamp,
      },
    });
    return {
      id: record.id,
      studentId: record.studentId,
      deviceId: record.deviceId,
      clientMutationId: record.clientMutationId,
      sequence: record.sequence,
      entityType: record.entityType,
      entityId: record.entityId,
      operation: record.operation,
      payload: record.payload,
      timestamp: record.timestamp,
      createdAt: record.createdAt,
    };
  }

  async getMutationsAfter(
    studentId: string,
    timestampOrSequence: string | number,
    limit = 100
  ): Promise<BackendSyncMutation[]> {
    let whereClause: any = { studentId };

    if (typeof timestampOrSequence === 'number') {
      whereClause.sequence = { gt: timestampOrSequence };
    } else {
      whereClause.timestamp = { gt: timestampOrSequence };
    }

    const records = await this.prisma.syncMutationRecord.findMany({
      where: whereClause,
      orderBy: { sequence: 'asc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      deviceId: r.deviceId,
      clientMutationId: r.clientMutationId,
      sequence: r.sequence,
      entityType: r.entityType,
      entityId: r.entityId,
      operation: r.operation,
      payload: r.payload,
      timestamp: r.timestamp,
      createdAt: r.createdAt,
    }));
  }

  async getMaxSequence(studentId: string): Promise<number> {
    const agg = await this.prisma.syncMutationRecord.aggregate({
      where: { studentId },
      _max: { sequence: true },
    });
    return agg._max.sequence ?? 0;
  }

  // --- Tombstones ---

  async recordTombstone(
    tombstoneData: Omit<BackendTombstone, 'id' | 'sequence' | 'createdAt'>
  ): Promise<BackendTombstone> {
    const record = await this.prisma.tombstone.upsert({
      where: {
        studentId_entityType_entityId: {
          studentId: tombstoneData.studentId,
          entityType: tombstoneData.entityType,
          entityId: tombstoneData.entityId,
        },
      },
      update: {
        deletedAt: tombstoneData.deletedAt,
      },
      create: {
        studentId: tombstoneData.studentId,
        entityType: tombstoneData.entityType,
        entityId: tombstoneData.entityId,
        deletedAt: tombstoneData.deletedAt,
      },
    });

    return {
      id: record.id,
      studentId: record.studentId,
      entityType: record.entityType,
      entityId: record.entityId,
      deletedAt: record.deletedAt,
      sequence: record.sequence,
      createdAt: record.createdAt,
    };
  }

  async getTombstonesAfter(
    studentId: string,
    timestampOrSequence: string | number
  ): Promise<BackendTombstone[]> {
    let whereClause: any = { studentId };

    if (typeof timestampOrSequence === 'number') {
      whereClause.sequence = { gt: timestampOrSequence };
    } else {
      whereClause.deletedAt = { gt: timestampOrSequence };
    }

    const records = await this.prisma.tombstone.findMany({
      where: whereClause,
      orderBy: { sequence: 'asc' },
    });

    return records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      entityType: r.entityType,
      entityId: r.entityId,
      deletedAt: r.deletedAt,
      sequence: r.sequence,
      createdAt: r.createdAt,
    }));
  }

  // --- Entity Operations ---

  async upsertGoal(goal: BackendGoal): Promise<BackendGoal> {
    const record = await this.prisma.goal.upsert({
      where: { id: goal.id },
      update: {
        title: goal.title,
        description: goal.description,
        status: goal.status,
        updatedAt: goal.updatedAt,
      },
      create: {
        id: goal.id,
        studentId: goal.studentId,
        title: goal.title,
        description: goal.description,
        status: goal.status,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
      },
    });
    return record;
  }

  async deleteGoal(studentId: string, id: string): Promise<void> {
    await this.prisma.goal.deleteMany({
      where: { id, studentId },
    });
  }

  async getGoals(studentId: string): Promise<BackendGoal[]> {
    return this.prisma.goal.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertRoadmap(roadmap: BackendRoadmap): Promise<BackendRoadmap> {
    const record = await this.prisma.roadmap.upsert({
      where: { id: roadmap.id },
      update: {
        goalId: roadmap.goalId,
        title: roadmap.title,
        updatedAt: roadmap.updatedAt,
      },
      create: {
        id: roadmap.id,
        studentId: roadmap.studentId,
        goalId: roadmap.goalId,
        title: roadmap.title,
        createdAt: roadmap.createdAt,
        updatedAt: roadmap.updatedAt,
      },
    });
    return record;
  }

  async deleteRoadmap(studentId: string, id: string): Promise<void> {
    await this.prisma.roadmap.deleteMany({
      where: { id, studentId },
    });
  }

  async getRoadmaps(studentId: string): Promise<BackendRoadmap[]> {
    return this.prisma.roadmap.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertTask(task: BackendTask): Promise<BackendTask> {
    const record = await this.prisma.task.upsert({
      where: { id: task.id },
      update: {
        roadmapId: task.roadmapId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt,
      },
      create: {
        id: task.id,
        studentId: task.studentId,
        roadmapId: task.roadmapId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt,
      },
    });
    return record;
  }

  async deleteTask(studentId: string, id: string): Promise<void> {
    await this.prisma.task.deleteMany({
      where: { id, studentId },
    });
  }

  async getTasks(studentId: string): Promise<BackendTask[]> {
    return this.prisma.task.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertSession(session: BackendSession): Promise<BackendSession> {
    const record = await this.prisma.session.upsert({
      where: { id: session.id },
      update: {
        taskId: session.taskId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMinutes: session.durationMinutes,
      },
      create: {
        id: session.id,
        studentId: session.studentId,
        taskId: session.taskId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMinutes: session.durationMinutes,
      },
    });
    return record;
  }

  async deleteSession(studentId: string, id: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { id, studentId },
    });
  }

  async getSessions(studentId: string): Promise<BackendSession[]> {
    return this.prisma.session.findMany({
      where: { studentId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async upsertWeeklyPlan(plan: BackendWeeklyPlan): Promise<BackendWeeklyPlan> {
    const record = await this.prisma.weeklyPlan.upsert({
      where: { id: plan.id },
      update: {
        weekIdentifier: plan.weekIdentifier,
        title: plan.title,
        targetMinutes: plan.targetMinutes,
        updatedAt: plan.updatedAt,
      },
      create: {
        id: plan.id,
        studentId: plan.studentId,
        weekIdentifier: plan.weekIdentifier,
        title: plan.title,
        targetMinutes: plan.targetMinutes,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      },
    });
    return record;
  }

  async deleteWeeklyPlan(studentId: string, id: string): Promise<void> {
    await this.prisma.weeklyPlan.deleteMany({
      where: { id, studentId },
    });
  }

  async getWeeklyPlans(studentId: string): Promise<BackendWeeklyPlan[]> {
    return this.prisma.weeklyPlan.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertWeeklyPlanItem(item: BackendWeeklyPlanItem): Promise<BackendWeeklyPlanItem> {
    const record = await this.prisma.weeklyPlanItem.upsert({
      where: { id: item.id },
      update: {
        weeklyPlanId: item.weeklyPlanId,
        taskId: item.taskId,
        targetDate: item.targetDate,
        plannedMinutes: item.plannedMinutes,
        isCompleted: item.isCompleted,
      },
      create: {
        id: item.id,
        studentId: item.studentId,
        weeklyPlanId: item.weeklyPlanId,
        taskId: item.taskId,
        targetDate: item.targetDate,
        plannedMinutes: item.plannedMinutes,
        isCompleted: item.isCompleted,
      },
    });
    return record;
  }

  async deleteWeeklyPlanItem(studentId: string, id: string): Promise<void> {
    await this.prisma.weeklyPlanItem.deleteMany({
      where: { id, studentId },
    });
  }

  async getWeeklyPlanItems(studentId: string): Promise<BackendWeeklyPlanItem[]> {
    return this.prisma.weeklyPlanItem.findMany({
      where: { studentId },
    });
  }

  // --- Teacher Grants ---

  async createTeacherGrant(
    grantData: Omit<BackendTeacherAccessGrant, 'id'>
  ): Promise<BackendTeacherAccessGrant> {
    const record = await this.prisma.teacherAccessGrant.create({
      data: {
        studentId: grantData.studentId,
        teacherId: grantData.teacherId,
        label: grantData.label,
        token: grantData.token,
        role: grantData.role,
        permissions: JSON.stringify(grantData.permissions),
        createdAt: grantData.createdAt,
        expiresAt: grantData.expiresAt,
        isActive: grantData.isActive,
      },
    });

    return {
      id: record.id,
      studentId: record.studentId,
      teacherId: record.teacherId,
      label: record.label,
      token: record.token,
      role: record.role,
      permissions: JSON.parse(record.permissions),
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      isActive: record.isActive,
    };
  }

  async getTeacherGrantById(id: string): Promise<BackendTeacherAccessGrant | null> {
    const record = await this.prisma.teacherAccessGrant.findUnique({
      where: { id },
    });
    if (!record) return null;
    return {
      id: record.id,
      studentId: record.studentId,
      teacherId: record.teacherId,
      label: record.label,
      token: record.token,
      role: record.role,
      permissions: JSON.parse(record.permissions),
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      isActive: record.isActive,
    };
  }

  async getTeacherGrantByToken(token: string): Promise<BackendTeacherAccessGrant | null> {
    const record = await this.prisma.teacherAccessGrant.findUnique({
      where: { token },
    });
    if (!record) return null;
    return {
      id: record.id,
      studentId: record.studentId,
      teacherId: record.teacherId,
      label: record.label,
      token: record.token,
      role: record.role,
      permissions: JSON.parse(record.permissions),
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      isActive: record.isActive,
    };
  }

  async getTeacherGrantsForStudent(studentId: string): Promise<BackendTeacherAccessGrant[]> {
    const records = await this.prisma.teacherAccessGrant.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      teacherId: r.teacherId,
      label: r.label,
      token: r.token,
      role: r.role,
      permissions: JSON.parse(r.permissions),
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      isActive: r.isActive,
    }));
  }

  async revokeTeacherGrant(id: string): Promise<BackendTeacherAccessGrant> {
    const record = await this.prisma.teacherAccessGrant.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date().toISOString(),
      },
    });
    return {
      id: record.id,
      studentId: record.studentId,
      teacherId: record.teacherId,
      label: record.label,
      token: record.token,
      role: record.role,
      permissions: JSON.parse(record.permissions),
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      isActive: record.isActive,
    };
  }
}
