/**
 * Dexie WeeklyPlan Repository Implementation
 */

import { EntityId, WeeklyPlan, validateWeeklyPlan } from '../../../domain';
import { PathFlowDB } from '../../local/database';
import { WeeklyPlanRecord } from '../../local/schema';
import { WeeklyPlanRepository } from '../interfaces/weeklyPlanRepository';
import {
  DomainValidationError,
  EntityNotFoundError,
  DependencyConstraintError,
} from '../../errors';

export class DexieWeeklyPlanRepository implements WeeklyPlanRepository {
  constructor(private readonly db: PathFlowDB) {}

  async create(plan: WeeklyPlan): Promise<WeeklyPlan> {
    const validation = validateWeeklyPlan(plan);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    const headerRecord: WeeklyPlanRecord = {
      id: plan.id,
      weekIdentifier: plan.weekIdentifier,
      title: plan.title,
      targetMinutes: plan.targetMinutes,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };

    await this.db.transaction('rw', [this.db.weeklyPlans, this.db.weeklyPlanItems], async () => {
      await this.db.weeklyPlans.add(headerRecord);

      if (plan.items && plan.items.length > 0) {
        await this.db.weeklyPlanItems.bulkAdd(Array.from(plan.items));
      }
    });

    return plan;
  }

  async getById(id: EntityId): Promise<WeeklyPlan | null> {
    const record = await this.db.weeklyPlans.get(id);
    if (!record) {
      return null;
    }

    const items = await this.db.weeklyPlanItems
      .where('weeklyPlanId')
      .equals(id)
      .toArray();

    return {
      ...record,
      items,
    };
  }

  async getByWeekIdentifier(weekIdentifier: string): Promise<WeeklyPlan | null> {
    const record = await this.db.weeklyPlans
      .where('weekIdentifier')
      .equals(weekIdentifier.trim())
      .first();

    if (!record) {
      return null;
    }

    const items = await this.db.weeklyPlanItems
      .where('weeklyPlanId')
      .equals(record.id)
      .toArray();

    return {
      ...record,
      items,
    };
  }

  async getAll(): Promise<WeeklyPlan[]> {
    const records = await this.db.weeklyPlans.orderBy('createdAt').toArray();

    return await Promise.all(
      records.map(async (record) => {
        const items = await this.db.weeklyPlanItems
          .where('weeklyPlanId')
          .equals(record.id)
          .toArray();

        return {
          ...record,
          items,
        };
      })
    );
  }

  async update(plan: WeeklyPlan): Promise<WeeklyPlan> {
    const validation = validateWeeklyPlan(plan);
    if (!validation.isValid) {
      throw new DomainValidationError(validation.errors);
    }

    const existing = await this.db.weeklyPlans.get(plan.id);
    if (!existing) {
      throw new EntityNotFoundError(`WeeklyPlan with ID "${plan.id}" not found.`);
    }

    const headerRecord: WeeklyPlanRecord = {
      id: plan.id,
      weekIdentifier: plan.weekIdentifier,
      title: plan.title,
      targetMinutes: plan.targetMinutes,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };

    await this.db.weeklyPlans.put(headerRecord);
    return plan;
  }

  async delete(id: EntityId): Promise<void> {
    const existing = await this.db.weeklyPlans.get(id);
    if (!existing) {
      throw new EntityNotFoundError(`WeeklyPlan with ID "${id}" not found.`);
    }

    const itemCount = await this.db.weeklyPlanItems
      .where('weeklyPlanId')
      .equals(id)
      .count();

    if (itemCount > 0) {
      throw new DependencyConstraintError(
        `Cannot delete WeeklyPlan "${id}" because it still contains ${itemCount} planned item(s). Remove items first.`
      );
    }

    await this.db.weeklyPlans.delete(id);
  }
}
