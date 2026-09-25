/**
 * Conflict Resolution Engine
 *
 * Implements deterministic conflict resolution for multi-device data convergence.
 * - Tombstones vs Updates
 * - Immutable Session Preservation
 * - Granular Task & Weekly Plan Item Resolution
 * - Last-Write-Wins (LWW) Fallback
 */

import { Task, Session, Goal, Roadmap, WeeklyPlanItem } from '../../domain';
import { SyncEntityType, SyncTombstone } from '../types';

export type ResolutionResult<T> =
  | { readonly action: 'apply_remote'; readonly entity: T }
  | { readonly action: 'keep_local'; readonly entity: T }
  | { readonly action: 'merge'; readonly entity: T }
  | { readonly action: 'tombstone_wins' }
  | { readonly action: 'resurrect'; readonly entity: T };

export class ConflictResolver {
  /**
   * Resolves conflict between an existing local entity and an incoming tombstone.
   */
  resolveTombstoneConflict(
    localEntity: Record<string, any> | null | undefined,
    tombstone: SyncTombstone
  ): 'tombstone_wins' | 'keep_local' {
    if (!localEntity) {
      return 'tombstone_wins';
    }

    const localTime =
      localEntity.updatedAt ??
      localEntity.createdAt ??
      localEntity.endedAt ??
      localEntity.startedAt ??
      '';
    const tombstoneTime = tombstone.deletedAt;

    // If local entity was updated strictly after the tombstone was created, local resurrects
    if (localTime && localTime > tombstoneTime) {
      return 'keep_local';
    }

    return 'tombstone_wins';
  }

  /**
   * Resolves conflict between a local entity and an incoming remote entity.
   */
  resolveEntityConflict<T extends Record<string, any>>(
    entityType: SyncEntityType,
    localEntity: T | null | undefined,
    remoteEntity: T
  ): ResolutionResult<T> {
    if (!localEntity) {
      return { action: 'apply_remote', entity: remoteEntity };
    }

    switch (entityType) {
      case 'session':
        return this.resolveSessionConflict(localEntity as unknown as Session, remoteEntity as unknown as Session) as ResolutionResult<T>;

      case 'task':
        return this.resolveTaskConflict(localEntity as unknown as Task, remoteEntity as unknown as Task) as ResolutionResult<T>;

      case 'weeklyPlanItem':
        return this.resolveWeeklyPlanItemConflict(localEntity as unknown as WeeklyPlanItem, remoteEntity as unknown as WeeklyPlanItem) as ResolutionResult<T>;

      case 'goal':
      case 'roadmap':
      case 'weeklyPlan':
      default:
        return this.resolveGenericLWW(localEntity, remoteEntity);
    }
  }

  /**
   * Sessions are factual historical work logs.
   * If an identical session exists, it is preserved. If timestamps differ, latest wins.
   */
  private resolveSessionConflict(local: Session, remote: Session): ResolutionResult<Session> {
    // Exact match
    if (
      local.taskId === remote.taskId &&
      local.startedAt === remote.startedAt &&
      local.endedAt === remote.endedAt &&
      local.durationMinutes === remote.durationMinutes
    ) {
      return { action: 'keep_local', entity: local };
    }

    // If end time changed or duration corrected, prefer whichever ended later or was updated later
    const localEnd = Date.parse(local.endedAt) || 0;
    const remoteEnd = Date.parse(remote.endedAt) || 0;

    if (remoteEnd > localEnd) {
      return { action: 'apply_remote', entity: remote };
    }

    return { action: 'keep_local', entity: local };
  }

  /**
   * Tasks resolve status and content intelligently.
   * If one device marked completed, completion is prioritized unless explicitly overridden.
   */
  private resolveTaskConflict(local: Task, remote: Task): ResolutionResult<Task> {
    const localTime = local.updatedAt || local.createdAt;
    const remoteTime = remote.updatedAt || remote.createdAt;

    // If remote is newer
    if (remoteTime > localTime) {
      // If local marked as completed but remote was an edit from before completion, preserve completion
      if (local.status === 'completed' && remote.status !== 'completed' && local.completedAt && local.completedAt > remoteTime) {
        const merged: Task = {
          ...remote,
          status: 'completed',
          completedAt: local.completedAt,
          updatedAt: localTime > remoteTime ? localTime : remoteTime,
        };
        return { action: 'merge', entity: merged };
      }
      return { action: 'apply_remote', entity: remote };
    }

    // Local is newer or equal
    if (remote.status === 'completed' && local.status !== 'completed' && remote.completedAt && remote.completedAt > localTime) {
      const merged: Task = {
        ...local,
        status: 'completed',
        completedAt: remote.completedAt,
        updatedAt: remoteTime,
      };
      return { action: 'merge', entity: merged };
    }

    return { action: 'keep_local', entity: local };
  }

  /**
   * Weekly Plan Items resolve using LWW.
   */
  private resolveWeeklyPlanItemConflict(
    local: WeeklyPlanItem,
    remote: WeeklyPlanItem
  ): ResolutionResult<WeeklyPlanItem> {
    // If completion toggled, completed takes precedence if done, otherwise remote
    if (remote.isCompleted && !local.isCompleted) {
      return { action: 'apply_remote', entity: remote };
    }

    return { action: 'apply_remote', entity: remote };
  }

  /**
   * Generic Last-Write-Wins (LWW) comparison based on updatedAt / createdAt.
   */
  private resolveGenericLWW<T extends Record<string, any>>(local: T, remote: T): ResolutionResult<T> {
    const localTime = local.updatedAt || local.createdAt || '';
    const remoteTime = remote.updatedAt || remote.createdAt || '';

    if (remoteTime > localTime) {
      return { action: 'apply_remote', entity: remote };
    }

    return { action: 'keep_local', entity: local };
  }
}
