/**
 * Dexie Task Repository Implementation
 */

import {
  EntityId,
  Task,
  TaskStatus,
  validateTask,
  canTransitionTaskStatus,
} from '../../../domain';
import { PathFlowDB } from '../../local/database';
import { TaskRepository } from '../interfaces/taskRepository';
import {
  DomainValidationError,
  EntityNotFoundError,
  DependencyConstraintError,
} from '../../errors';

export class DexieTaskRepository implements TaskRepository {
  constructor(private readonly db: PathFlowDB) {}

  async create(task: Task): Promise<Task> {
    const validation = validateTask(task);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    const parentRoadmap = await this.db.roadmaps.get(task.roadmapId);
    if (!parentRoadmap) {
      throw new EntityNotFoundError(
        `Referenced parent Roadmap "${task.roadmapId}" does not exist.`
      );
    }

    await this.db.tasks.add(task);
    return task;
  }

  async getById(id: EntityId): Promise<Task | null> {
    const task = await this.db.tasks.get(id);
    return task ?? null;
  }

  async getAll(): Promise<Task[]> {
    return await this.db.tasks.orderBy('createdAt').toArray();
  }

  async getByRoadmapId(roadmapId: EntityId): Promise<Task[]> {
    return await this.db.tasks.where('roadmapId').equals(roadmapId).toArray();
  }

  async getByStatus(status: TaskStatus): Promise<Task[]> {
    return await this.db.tasks.where('status').equals(status).toArray();
  }

  async update(task: Task): Promise<Task> {
    const validation = validateTask(task);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    const existing = await this.getById(task.id);
    if (!existing) {
      throw new EntityNotFoundError(`Task with ID "${task.id}" not found.`);
    }

    // Preserve task status transition rules
    if (existing.status !== task.status) {
      if (!canTransitionTaskStatus(existing.status, task.status)) {
        throw new DomainValidationError([
          `Illegal Task status transition from "${existing.status}" to "${task.status}".`,
        ]);
      }
    }

    const parentRoadmap = await this.db.roadmaps.get(task.roadmapId);
    if (!parentRoadmap) {
      throw new EntityNotFoundError(
        `Referenced parent Roadmap "${task.roadmapId}" does not exist.`
      );
    }

    await this.db.tasks.put(task);
    return task;
  }

  async delete(id: EntityId): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new EntityNotFoundError(`Task with ID "${id}" not found.`);
    }

    const sessionCount = await this.db.sessions
      .where('taskId')
      .equals(id)
      .count();
    const planItemCount = await this.db.weeklyPlanItems
      .where('taskId')
      .equals(id)
      .count();

    if (sessionCount > 0 || planItemCount > 0) {
      throw new DependencyConstraintError(
        `Cannot delete Task "${id}" because it has ${sessionCount} recorded Session(s) and ${planItemCount} planned Weekly Plan item(s). Remove or reassign them first.`
      );
    }

    await this.db.tasks.delete(id);
  }
}
