/**
 * Dexie Roadmap Repository Implementation
 */

import { EntityId, Roadmap, validateRoadmap } from '../../../domain';
import { PathFlowDB } from '../../local/database';
import { RoadmapRepository } from '../interfaces/roadmapRepository';
import {
  DomainValidationError,
  EntityNotFoundError,
  DependencyConstraintError,
} from '../../errors';

export class DexieRoadmapRepository implements RoadmapRepository {
  constructor(private readonly db: PathFlowDB) {}

  async create(roadmap: Roadmap): Promise<Roadmap> {
    const validation = validateRoadmap(roadmap);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    const parentGoal = await this.db.goals.get(roadmap.goalId);
    if (!parentGoal) {
      throw new EntityNotFoundError(
        `Referenced parent Goal "${roadmap.goalId}" does not exist.`
      );
    }

    await this.db.roadmaps.add(roadmap);
    return roadmap;
  }

  async getById(id: EntityId): Promise<Roadmap | null> {
    const roadmap = await this.db.roadmaps.get(id);
    return roadmap ?? null;
  }

  async getAll(): Promise<Roadmap[]> {
    return await this.db.roadmaps.orderBy('createdAt').toArray();
  }

  async getByGoalId(goalId: EntityId): Promise<Roadmap[]> {
    return await this.db.roadmaps.where('goalId').equals(goalId).toArray();
  }

  async update(roadmap: Roadmap): Promise<Roadmap> {
    const validation = validateRoadmap(roadmap);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    const existing = await this.getById(roadmap.id);
    if (!existing) {
      throw new EntityNotFoundError(`Roadmap with ID "${roadmap.id}" not found.`);
    }

    const parentGoal = await this.db.goals.get(roadmap.goalId);
    if (!parentGoal) {
      throw new EntityNotFoundError(
        `Referenced parent Goal "${roadmap.goalId}" does not exist.`
      );
    }

    await this.db.roadmaps.put(roadmap);
    return roadmap;
  }

  async delete(id: EntityId): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new EntityNotFoundError(`Roadmap with ID "${id}" not found.`);
    }

    const dependentTasks = await this.db.tasks
      .where('roadmapId')
      .equals(id)
      .count();
    if (dependentTasks > 0) {
      throw new DependencyConstraintError(
        `Cannot delete Roadmap "${id}" because it still contains ${dependentTasks} Task(s). Remove or reassign Tasks first.`
      );
    }

    await this.db.roadmaps.delete(id);
  }
}
