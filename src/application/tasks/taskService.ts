/**
 * Task Application Service
 *
 * Orchestrates Task lifecycle operations, coordinating with TaskRepository,
 * RoadmapRepository, SessionRepository, and WeeklyPlanItemRepository.
 * Delegates status lifecycle transitions exclusively to the Domain Layer.
 */

import {
  EntityId,
  Task,
  TaskStatus,
  createTask,
  validateTask,
  canTransitionTaskStatus,
  transitionTaskStatus,
  createTimestamp,
  isValidEntityId,
} from '../../domain';
import {
  TaskRepository,
  RoadmapRepository,
  SessionRepository,
  WeeklyPlanItemRepository,
} from '../../data/repositories/interfaces';
import {
  ValidationError,
  NotFoundError,
  DependencyConstraintError,
  InvalidStateTransitionError,
  handleRepositoryError,
} from '../errors';
import { CreateTaskInput, UpdateTaskInput } from '../types';

export class TaskService {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly roadmapRepo: RoadmapRepository,
    private readonly sessionRepo?: SessionRepository,
    private readonly weeklyPlanItemRepo?: WeeklyPlanItemRepository
  ) {}

  /**
   * Creates and persists a new Task under a parent Roadmap.
   */
  async createTask(input: CreateTaskInput): Promise<Task> {
    if (!isValidEntityId(input.roadmapId)) {
      throw new ValidationError(['Task must reference a valid Roadmap ID (roadmapId).']);
    }

    const parentRoadmap = await this.roadmapRepo.getById(input.roadmapId);
    if (!parentRoadmap) {
      throw new NotFoundError('Roadmap', input.roadmapId);
    }

    const task = createTask({
      roadmapId: input.roadmapId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      estimatedMinutes: input.estimatedMinutes,
    });

    const validation = validateTask(task);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.taskRepo.create(task);
    } catch (err) {
      handleRepositoryError(err, `Failed to create Task "${input.title}".`);
    }
  }

  /**
   * Retrieves a single Task by its identifier.
   */
  async getTask(id: EntityId): Promise<Task> {
    if (!isValidEntityId(id)) {
      throw new ValidationError(['Task ID must be a valid non-empty identifier.']);
    }

    let task: Task | null;
    try {
      task = await this.taskRepo.getById(id);
    } catch (err) {
      handleRepositoryError(err, `Failed to fetch Task "${id}".`);
    }

    if (!task) {
      throw new NotFoundError('Task', id);
    }

    return task;
  }

  /**
   * Lists all Tasks across the application.
   */
  async listTasks(): Promise<Task[]> {
    try {
      return await this.taskRepo.getAll();
    } catch (err) {
      handleRepositoryError(err, 'Failed to list Tasks.');
    }
  }

  /**
   * Lists all Tasks belonging to a specific Roadmap.
   */
  async listTasksForRoadmap(roadmapId: EntityId): Promise<Task[]> {
    if (!isValidEntityId(roadmapId)) {
      throw new ValidationError(['Roadmap ID must be a valid non-empty identifier.']);
    }

    const parentRoadmap = await this.roadmapRepo.getById(roadmapId);
    if (!parentRoadmap) {
      throw new NotFoundError('Roadmap', roadmapId);
    }

    try {
      return await this.taskRepo.getByRoadmapId(roadmapId);
    } catch (err) {
      handleRepositoryError(err, `Failed to list Tasks for Roadmap "${roadmapId}".`);
    }
  }

  /**
   * Updates Task attributes and orchestrates status transitions via the Domain Layer.
   */
  async updateTask(id: EntityId, input: UpdateTaskInput): Promise<Task> {
    const existing = await this.getTask(id);

    let targetRoadmapId = existing.roadmapId;
    if (input.roadmapId !== undefined && input.roadmapId !== existing.roadmapId) {
      if (!isValidEntityId(input.roadmapId)) {
        throw new ValidationError(['Roadmap ID must be a valid non-empty identifier.']);
      }
      const parentRoadmap = await this.roadmapRepo.getById(input.roadmapId);
      if (!parentRoadmap) {
        throw new NotFoundError('Roadmap', input.roadmapId);
      }
      targetRoadmapId = input.roadmapId;
    }

    let taskWithStatus = existing;
    if (input.status !== undefined && input.status !== existing.status) {
      if (!canTransitionTaskStatus(existing.status, input.status)) {
        throw new InvalidStateTransitionError(
          existing.status,
          input.status,
          `Illegal Task status transition from "${existing.status}" to "${input.status}".`
        );
      }
      taskWithStatus = transitionTaskStatus(existing, input.status);
    }

    const now = createTimestamp();
    const updated: Task = {
      ...taskWithStatus,
      roadmapId: targetRoadmapId,
      title: input.title !== undefined ? input.title.trim() : taskWithStatus.title,
      description: input.description !== undefined ? input.description.trim() : taskWithStatus.description,
      priority: input.priority ?? taskWithStatus.priority,
      estimatedMinutes:
        input.estimatedMinutes !== undefined
          ? Math.max(0, input.estimatedMinutes)
          : taskWithStatus.estimatedMinutes,
      updatedAt: now,
    };

    const validation = validateTask(updated);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.taskRepo.update(updated);
    } catch (err) {
      handleRepositoryError(err, `Failed to update Task "${id}".`);
    }
  }

  /**
   * Transitions a Task status using domain lifecycle transition logic.
   */
  async transitionTaskStatus(id: EntityId, targetStatus: TaskStatus): Promise<Task> {
    const existing = await this.getTask(id);

    if (existing.status === targetStatus) {
      return existing;
    }

    if (!canTransitionTaskStatus(existing.status, targetStatus)) {
      throw new InvalidStateTransitionError(
        existing.status,
        targetStatus,
        `Illegal Task status transition from "${existing.status}" to "${targetStatus}".`
      );
    }

    const transitioned = transitionTaskStatus(existing, targetStatus);
    const validation = validateTask(transitioned);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.taskRepo.update(transitioned);
    } catch (err) {
      handleRepositoryError(err, `Failed to transition Task "${id}" status.`);
    }
  }

  /**
   * Deletes a Task after verifying no recorded Sessions or Weekly Plan items depend on it.
   */
  async deleteTask(id: EntityId): Promise<void> {
    await this.getTask(id);

    let sessionCount = 0;
    if (this.sessionRepo) {
      const sessions = await this.sessionRepo.getByTaskId(id);
      sessionCount = sessions.length;
    }

    let planItemCount = 0;
    if (this.weeklyPlanItemRepo) {
      const planItems = await this.weeklyPlanItemRepo.getByTaskId(id);
      planItemCount = planItems.length;
    }

    if (sessionCount > 0 || planItemCount > 0) {
      throw new DependencyConstraintError(
        `Cannot delete Task "${id}" because it has ${sessionCount} recorded Session(s) and ${planItemCount} planned Weekly Plan item(s). Remove or reassign them first.`
      );
    }

    try {
      await this.taskRepo.delete(id);
    } catch (err) {
      handleRepositoryError(err, `Failed to delete Task "${id}".`);
    }
  }
}
