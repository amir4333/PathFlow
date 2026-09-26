/**
 * Sync-Recording Repository Decorator
 *
 * Automatically records mutations into the durable Outbox queue on local writes
 * (create, update, delete) while transparently delegating all queries directly
 * to the underlying repositories.
 */

import { PathFlowRepositories } from '../../data/repositories/local';
import { SyncOutboxRepository } from './syncOutbox';
import { SyncEntityType, SyncOperation } from '../types';
import { generateEntityId, createTimestamp, EntityId } from '../../domain';

export interface SyncRecordingOptions {
  readonly repositories: PathFlowRepositories;
  readonly outbox: SyncOutboxRepository;
  readonly getDeviceId: () => string;
  readonly onMutationRecorded?: () => void;
}

export function createSyncRecordingRepositories(
  options: SyncRecordingOptions
): PathFlowRepositories {
  const { repositories: r, outbox, getDeviceId, onMutationRecorded } = options;

  async function recordMutation<T>(
    entityType: SyncEntityType,
    operation: SyncOperation,
    entityId: EntityId,
    payload: T | null
  ): Promise<void> {
    try {
      await outbox.enqueue({
        id: generateEntityId(),
        clientMutationId: generateEntityId(),
        entityType,
        entityId,
        operation,
        payload,
        timestamp: createTimestamp(),
        deviceId: getDeviceId(),
      });
      if (onMutationRecorded) {
        onMutationRecorded();
      }
    } catch (err) {
      console.warn('Failed to enqueue sync mutation to outbox', err);
    }
  }

  return {
    goals: {
      getById: (id) => r.goals.getById(id),
      getAll: () => r.goals.getAll(),
      create: async (goal) => {
        const created = await r.goals.create(goal);
        await recordMutation('goal', 'create', created.id, created);
        return created;
      },
      update: async (goal) => {
        const updated = await r.goals.update(goal);
        await recordMutation('goal', 'update', updated.id, updated);
        return updated;
      },
      delete: async (id) => {
        await r.goals.delete(id);
        await recordMutation('goal', 'delete', id, null);
      },
    },

    roadmaps: {
      getById: (id) => r.roadmaps.getById(id),
      getAll: () => r.roadmaps.getAll(),
      getByGoalId: (goalId) => r.roadmaps.getByGoalId(goalId),
      create: async (roadmap) => {
        const created = await r.roadmaps.create(roadmap);
        await recordMutation('roadmap', 'create', created.id, created);
        return created;
      },
      update: async (roadmap) => {
        const updated = await r.roadmaps.update(roadmap);
        await recordMutation('roadmap', 'update', updated.id, updated);
        return updated;
      },
      delete: async (id) => {
        await r.roadmaps.delete(id);
        await recordMutation('roadmap', 'delete', id, null);
      },
    },

    tasks: {
      getById: (id) => r.tasks.getById(id),
      getAll: () => r.tasks.getAll(),
      getByRoadmapId: (roadmapId) => r.tasks.getByRoadmapId(roadmapId),
      getByStatus: (status) => r.tasks.getByStatus(status),
      create: async (task) => {
        const created = await r.tasks.create(task);
        await recordMutation('task', 'create', created.id, created);
        return created;
      },
      update: async (task) => {
        const updated = await r.tasks.update(task);
        await recordMutation('task', 'update', updated.id, updated);
        return updated;
      },
      delete: async (id) => {
        await r.tasks.delete(id);
        await recordMutation('task', 'delete', id, null);
      },
    },

    sessions: {
      getById: (id) => r.sessions.getById(id),
      getAll: () => r.sessions.getAll(),
      getByTaskId: (taskId) => r.sessions.getByTaskId(taskId),
      getByDateRange: (start, end) => r.sessions.getByDateRange(start, end),
      getByDate: (date) => r.sessions.getByDate(date),
      getByWeek: (weekId) => r.sessions.getByWeek(weekId),
      create: async (session) => {
        const created = await r.sessions.create(session);
        await recordMutation('session', 'create', created.id, created);
        return created;
      },
      update: async (session) => {
        const updated = await r.sessions.update(session);
        await recordMutation('session', 'update', updated.id, updated);
        return updated;
      },
      delete: async (id) => {
        await r.sessions.delete(id);
        await recordMutation('session', 'delete', id, null);
      },
      getActiveSession: () => r.sessions.getActiveSession(),
      startActiveSession: (taskId, startedAt) => r.sessions.startActiveSession(taskId, startedAt),
      stopActiveSession: async (endedAt) => {
        const completedSession = await r.sessions.stopActiveSession(endedAt);
        await recordMutation('session', 'create', completedSession.id, completedSession);
        return completedSession;
      },
      discardActiveSession: () => r.sessions.discardActiveSession(),
    },

    weeklyPlans: {
      getById: (id) => r.weeklyPlans.getById(id),
      getAll: () => r.weeklyPlans.getAll(),
      getByWeekIdentifier: (weekId) => r.weeklyPlans.getByWeekIdentifier(weekId),
      getByTaskId: (taskId) => r.weeklyPlans.getByTaskId(taskId),
      getItemsByPlanId: (planId) => r.weeklyPlans.getItemsByPlanId(planId),
      create: async (plan) => {
        const created = await r.weeklyPlans.create(plan);
        await recordMutation('weeklyPlan', 'create', created.id, created);
        return created;
      },
      update: async (plan) => {
        const updated = await r.weeklyPlans.update(plan);
        await recordMutation('weeklyPlan', 'update', updated.id, updated);
        return updated;
      },
      delete: async (id) => {
        await r.weeklyPlans.delete(id);
        await recordMutation('weeklyPlan', 'delete', id, null);
      },
    },

    weeklyPlanItems: {
      getById: (id) => r.weeklyPlanItems.getById(id),
      getByPlanId: (planId) => r.weeklyPlanItems.getByPlanId(planId),
      getByTaskId: (taskId) => r.weeklyPlanItems.getByTaskId(taskId),
      getByDate: (date) => r.weeklyPlanItems.getByDate(date),
      getUnallocatedByPlanId: (planId) => r.weeklyPlanItems.getUnallocatedByPlanId(planId),
      create: async (item) => {
        const created = await r.weeklyPlanItems.create(item);
        await recordMutation('weeklyPlanItem', 'create', created.id, created);
        return created;
      },
      update: async (item) => {
        const updated = await r.weeklyPlanItems.update(item);
        await recordMutation('weeklyPlanItem', 'update', updated.id, updated);
        return updated;
      },
      delete: async (id) => {
        await r.weeklyPlanItems.delete(id);
        await recordMutation('weeklyPlanItem', 'delete', id, null);
      },
    },
  };
}
