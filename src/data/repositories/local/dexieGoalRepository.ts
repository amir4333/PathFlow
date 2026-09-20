/**
 * Dexie Goal Repository Implementation
 */

import { EntityId, Goal, validateGoal } from '../../../domain';
import { PathFlowDB } from '../../local/database';
import { GoalRepository } from '../interfaces/goalRepository';
import {
  DomainValidationError,
  EntityNotFoundError,
  DependencyConstraintError,
} from '../../errors';

export class DexieGoalRepository implements GoalRepository {
  constructor(private readonly db: PathFlowDB) {}

  async create(goal: Goal): Promise<Goal> {
    const validation = validateGoal(goal);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }
    await this.db.goals.add(goal);
    return goal;
  }

  async getById(id: EntityId): Promise<Goal | null> {
    const goal = await this.db.goals.get(id);
    return goal ?? null;
  }

  async getAll(): Promise<Goal[]> {
    return await this.db.goals.orderBy('createdAt').toArray();
  }

  async update(goal: Goal): Promise<Goal> {
    const validation = validateGoal(goal);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }
    const existing = await this.getById(goal.id);
    if (!existing) {
      throw new EntityNotFoundError(`Goal with ID "${goal.id}" not found.`);
    }
    await this.db.goals.put(goal);
    return goal;
  }

  async delete(id: EntityId): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new EntityNotFoundError(`Goal with ID "${id}" not found.`);
    }

    const dependentRoadmaps = await this.db.roadmaps
      .where('goalId')
      .equals(id)
      .count();
    if (dependentRoadmaps > 0) {
      throw new DependencyConstraintError(
        `Cannot delete Goal "${id}" because it still contains ${dependentRoadmaps} active Roadmap(s). Remove or reassign Roadmaps first.`
      );
    }

    await this.db.goals.delete(id);
  }
}
