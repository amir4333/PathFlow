import { EntityId, Goal } from '../../../domain';

export interface GoalRepository {
  create(goal: Goal): Promise<Goal>;
  getById(id: EntityId): Promise<Goal | null>;
  getAll(): Promise<Goal[]>;
  update(goal: Goal): Promise<Goal>;
  delete(id: EntityId): Promise<void>;
}
