/**
 * Goal Application Service
 *
 * Orchestrates Goal lifecycle operations, coordinating with GoalRepository,
 * validating domain rules, and enforcing relational constraints.
 */

import {
  EntityId,
  Goal,
  createGoal,
  validateGoal,
  createTimestamp,
  isValidEntityId,
} from '../../domain';
import { GoalRepository, RoadmapRepository } from '../../data/repositories/interfaces';
import {
  ValidationError,
  NotFoundError,
  DependencyConstraintError,
  handleRepositoryError,
} from '../errors';
import { CreateGoalInput, UpdateGoalInput } from '../types';

export class GoalService {
  constructor(
    private readonly goalRepo: GoalRepository,
    private readonly roadmapRepo?: RoadmapRepository
  ) {}

  /**
   * Creates and persists a new Goal entity.
   */
  async createGoal(input: CreateGoalInput): Promise<Goal> {
    const goal = createGoal({
      title: input.title,
      description: input.description,
      status: input.status,
    });

    const validation = validateGoal(goal);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.goalRepo.create(goal);
    } catch (err) {
      handleRepositoryError(err, `Failed to create Goal "${input.title}".`);
    }
  }

  /**
   * Retrieves a single Goal by its identifier.
   */
  async getGoal(id: EntityId): Promise<Goal> {
    if (!isValidEntityId(id)) {
      throw new ValidationError(['Goal ID must be a valid non-empty identifier.']);
    }

    let goal: Goal | null;
    try {
      goal = await this.goalRepo.getById(id);
    } catch (err) {
      handleRepositoryError(err, `Failed to fetch Goal "${id}".`);
    }

    if (!goal) {
      throw new NotFoundError('Goal', id);
    }

    return goal;
  }

  /**
   * Lists all existing Goals chronologically.
   */
  async listGoals(): Promise<Goal[]> {
    try {
      return await this.goalRepo.getAll();
    } catch (err) {
      handleRepositoryError(err, 'Failed to list Goals.');
    }
  }

  /**
   * Updates attributes of an existing Goal entity.
   */
  async updateGoal(id: EntityId, input: UpdateGoalInput): Promise<Goal> {
    const existing = await this.getGoal(id);

    const now = createTimestamp();
    const updated: Goal = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      status: input.status ?? existing.status,
      updatedAt: now,
    };

    const validation = validateGoal(updated);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.goalRepo.update(updated);
    } catch (err) {
      handleRepositoryError(err, `Failed to update Goal "${id}".`);
    }
  }

  /**
   * Transitions a Goal status to 'archived'.
   */
  async archiveGoal(id: EntityId): Promise<Goal> {
    return await this.updateGoal(id, { status: 'archived' });
  }

  /**
   * Deletes a Goal entity after verifying no dependent Roadmaps remain.
   */
  async deleteGoal(id: EntityId): Promise<void> {
    await this.getGoal(id);

    if (this.roadmapRepo) {
      const roadmaps = await this.roadmapRepo.getByGoalId(id);
      if (roadmaps.length > 0) {
        throw new DependencyConstraintError(
          `Cannot delete Goal "${id}" because it still contains ${roadmaps.length} active Roadmap(s). Remove or reassign Roadmaps first.`
        );
      }
    }

    try {
      await this.goalRepo.delete(id);
    } catch (err) {
      handleRepositoryError(err, `Failed to delete Goal "${id}".`);
    }
  }
}
