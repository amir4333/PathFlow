import { EntityId, WeeklyPlan, WeeklyPlanItem } from '../../../domain';

export interface WeeklyPlanRepository {
  create(plan: WeeklyPlan): Promise<WeeklyPlan>;
  getById(id: EntityId): Promise<WeeklyPlan | null>;
  getByWeekIdentifier(weekIdentifier: string): Promise<WeeklyPlan | null>;
  getAll(): Promise<WeeklyPlan[]>;
  getByTaskId(taskId: EntityId): Promise<WeeklyPlan[]>;
  getItemsByPlanId(planId: EntityId): Promise<WeeklyPlanItem[]>;
  update(plan: WeeklyPlan): Promise<WeeklyPlan>;
  delete(id: EntityId): Promise<void>;
}
