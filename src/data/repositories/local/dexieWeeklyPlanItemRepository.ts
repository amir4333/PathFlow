/**
 * Dexie WeeklyPlanItem Repository Implementation
 */

import { EntityId, WeeklyPlanItem, validateWeeklyPlanItem } from '../../../domain';
import { PathFlowDB } from '../../local/database';
import { WeeklyPlanItemRepository } from '../interfaces/weeklyPlanItemRepository';
import {
  DomainValidationError,
  EntityNotFoundError,
} from '../../errors';

export class DexieWeeklyPlanItemRepository implements WeeklyPlanItemRepository {
  constructor(private readonly db: PathFlowDB) {}

  async create(item: WeeklyPlanItem): Promise<WeeklyPlanItem> {
    const validation = validateWeeklyPlanItem(item);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    const parentPlan = await this.db.weeklyPlans.get(item.weeklyPlanId);
    if (!parentPlan) {
      throw new EntityNotFoundError(
        `Referenced parent WeeklyPlan "${item.weeklyPlanId}" does not exist.`
      );
    }

    const task = await this.db.tasks.get(item.taskId);
    if (!task) {
      throw new EntityNotFoundError(
        `Referenced Task "${item.taskId}" does not exist.`
      );
    }

    await this.db.weeklyPlanItems.add(item);
    return item;
  }

  async getById(id: EntityId): Promise<WeeklyPlanItem | null> {
    const item = await this.db.weeklyPlanItems.get(id);
    return item ?? null;
  }

  async getByPlanId(weeklyPlanId: EntityId): Promise<WeeklyPlanItem[]> {
    return await this.db.weeklyPlanItems
      .where('weeklyPlanId')
      .equals(weeklyPlanId)
      .toArray();
  }

  async getByTaskId(taskId: EntityId): Promise<WeeklyPlanItem[]> {
    return await this.db.weeklyPlanItems.where('taskId').equals(taskId).toArray();
  }

  async getByDate(date: string): Promise<WeeklyPlanItem[]> {
    const targetDate = date.trim();
    return await this.db.weeklyPlanItems
      .where('targetDate')
      .equals(targetDate)
      .toArray();
  }

  async getUnallocatedByPlanId(weeklyPlanId: EntityId): Promise<WeeklyPlanItem[]> {
    const items = await this.db.weeklyPlanItems
      .where('weeklyPlanId')
      .equals(weeklyPlanId)
      .toArray();
    return items.filter((item) => !item.targetDate || item.targetDate.trim().length === 0);
  }

  async update(item: WeeklyPlanItem): Promise<WeeklyPlanItem> {
    const validation = validateWeeklyPlanItem(item);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    const existing = await this.getById(item.id);
    if (!existing) {
      throw new EntityNotFoundError(`WeeklyPlanItem with ID "${item.id}" not found.`);
    }

    const parentPlan = await this.db.weeklyPlans.get(item.weeklyPlanId);
    if (!parentPlan) {
      throw new EntityNotFoundError(
        `Referenced parent WeeklyPlan "${item.weeklyPlanId}" does not exist.`
      );
    }

    const task = await this.db.tasks.get(item.taskId);
    if (!task) {
      throw new EntityNotFoundError(
        `Referenced Task "${item.taskId}" does not exist.`
      );
    }

    await this.db.weeklyPlanItems.put(item);
    return item;
  }

  async delete(id: EntityId): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new EntityNotFoundError(`WeeklyPlanItem with ID "${id}" not found.`);
    }

    await this.db.weeklyPlanItems.delete(id);
  }
}
