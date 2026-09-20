import { EntityId, WeeklyPlanItem } from '../../../domain';

export interface WeeklyPlanItemRepository {
  create(item: WeeklyPlanItem): Promise<WeeklyPlanItem>;
  getById(id: EntityId): Promise<WeeklyPlanItem | null>;
  getByPlanId(weeklyPlanId: EntityId): Promise<WeeklyPlanItem[]>;
  getByTaskId(taskId: EntityId): Promise<WeeklyPlanItem[]>;
  getByDate(date: string): Promise<WeeklyPlanItem[]>;
  getUnallocatedByPlanId(weeklyPlanId: EntityId): Promise<WeeklyPlanItem[]>;
  update(item: WeeklyPlanItem): Promise<WeeklyPlanItem>;
  delete(id: EntityId): Promise<void>;
}
