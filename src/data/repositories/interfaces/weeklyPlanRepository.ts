import { EntityId, WeeklyPlan } from '../../../domain';

export interface WeeklyPlanRepository {
  create(plan: WeeklyPlan): Promise<WeeklyPlan>;
  getById(id: EntityId): Promise<WeeklyPlan | null>;
  getByWeekIdentifier(weekIdentifier: string): Promise<WeeklyPlan | null>;
  getAll(): Promise<WeeklyPlan[]>;
  update(plan: WeeklyPlan): Promise<WeeklyPlan>;
  delete(id: EntityId): Promise<void>;
}
