/**
 * Roadmap Application Service
 *
 * Orchestrates Roadmap lifecycle operations under parent Goals,
 * validating domain invariants and enforcing relational constraints with Tasks.
 */

import {
  EntityId,
  Roadmap,
  createRoadmap,
  validateRoadmap,
  createTimestamp,
  isValidEntityId,
} from '../../domain';
import {
  RoadmapRepository,
  GoalRepository,
  TaskRepository,
} from '../../data/repositories/interfaces';
import {
  ValidationError,
  NotFoundError,
  DependencyConstraintError,
  handleRepositoryError,
} from '../errors';
import { CreateRoadmapInput, UpdateRoadmapInput } from '../types';

export class RoadmapService {
  constructor(
    private readonly roadmapRepo: RoadmapRepository,
    private readonly goalRepo: GoalRepository,
    private readonly taskRepo?: TaskRepository
  ) {}

  /**
   * Creates and persists a new Roadmap linked to an existing parent Goal.
   */
  async createRoadmap(input: CreateRoadmapInput): Promise<Roadmap> {
    if (!isValidEntityId(input.goalId)) {
      throw new ValidationError(['Roadmap must reference a valid Goal ID (goalId).']);
    }

    // Verify referenced parent Goal exists
    const parentGoal = await this.goalRepo.getById(input.goalId);
    if (!parentGoal) {
      throw new NotFoundError('Goal', input.goalId);
    }

    const roadmap = createRoadmap({
      goalId: input.goalId,
      title: input.title,
      description: input.description,
    });

    const validation = validateRoadmap(roadmap);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.roadmapRepo.create(roadmap);
    } catch (err) {
      handleRepositoryError(err, `Failed to create Roadmap "${input.title}".`);
    }
  }

  /**
   * Retrieves a single Roadmap by its identifier.
   */
  async getRoadmap(id: EntityId): Promise<Roadmap> {
    if (!isValidEntityId(id)) {
      throw new ValidationError(['Roadmap ID must be a valid non-empty identifier.']);
    }

    let roadmap: Roadmap | null;
    try {
      roadmap = await this.roadmapRepo.getById(id);
    } catch (err) {
      handleRepositoryError(err, `Failed to fetch Roadmap "${id}".`);
    }

    if (!roadmap) {
      throw new NotFoundError('Roadmap', id);
    }

    return roadmap;
  }

  /**
   * Lists all Roadmaps belonging to a specific Goal.
   */
  async listRoadmapsForGoal(goalId: EntityId): Promise<Roadmap[]> {
    if (!isValidEntityId(goalId)) {
      throw new ValidationError(['Goal ID must be a valid non-empty identifier.']);
    }

    const parentGoal = await this.goalRepo.getById(goalId);
    if (!parentGoal) {
      throw new NotFoundError('Goal', goalId);
    }

    try {
      return await this.roadmapRepo.getByGoalId(goalId);
    } catch (err) {
      handleRepositoryError(err, `Failed to list Roadmaps for Goal "${goalId}".`);
    }
  }

  /**
   * Lists all existing Roadmaps across the application.
   */
  async listRoadmaps(): Promise<Roadmap[]> {
    try {
      return await this.roadmapRepo.getAll();
    } catch (err) {
      handleRepositoryError(err, 'Failed to list Roadmaps.');
    }
  }

  /**
   * Updates attributes of an existing Roadmap.
   */
  async updateRoadmap(id: EntityId, input: UpdateRoadmapInput): Promise<Roadmap> {
    const existing = await this.getRoadmap(id);

    let targetGoalId = existing.goalId;
    if (input.goalId !== undefined && input.goalId !== existing.goalId) {
      if (!isValidEntityId(input.goalId)) {
        throw new ValidationError(['Goal ID must be a valid non-empty identifier.']);
      }
      const newParentGoal = await this.goalRepo.getById(input.goalId);
      if (!newParentGoal) {
        throw new NotFoundError('Goal', input.goalId);
      }
      targetGoalId = input.goalId;
    }

    const now = createTimestamp();
    const updated: Roadmap = {
      ...existing,
      goalId: targetGoalId,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      updatedAt: now,
    };

    const validation = validateRoadmap(updated);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.roadmapRepo.update(updated);
    } catch (err) {
      handleRepositoryError(err, `Failed to update Roadmap "${id}".`);
    }
  }

  /**
   * Deletes a Roadmap after verifying no dependent Tasks remain.
   */
  async deleteRoadmap(id: EntityId): Promise<void> {
    await this.getRoadmap(id);

    if (this.taskRepo) {
      const dependentTasks = await this.taskRepo.getByRoadmapId(id);
      if (dependentTasks.length > 0) {
        throw new DependencyConstraintError(
          `Cannot delete Roadmap "${id}" because it still contains ${dependentTasks.length} Task(s). Remove or reassign Tasks first.`
        );
      }
    }

    try {
      await this.roadmapRepo.delete(id);
    } catch (err) {
      handleRepositoryError(err, `Failed to delete Roadmap "${id}".`);
    }
  }
}
