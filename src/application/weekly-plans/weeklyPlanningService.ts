/**
 * Weekly Planning Application Service
 *
 * Orchestrates WeeklyPlan lifecycle operations, coordinating with
 * WeeklyPlanRepository, WeeklyPlanItemRepository, and TaskRepository.
 * Enforces domain planning invariants:
 * - Valid ISO week identifiers
 * - Target dates within the corresponding ISO week
 * - Non-negative planned minutes
 * - Duplicate prevention (same task cannot be duplicated for the same date or weekly slot)
 * - Historical preservation
 */

import {
  EntityId,
  WeeklyPlan,
  WeeklyPlanItem,
  createWeeklyPlan,
  validateWeeklyPlan,
  createWeeklyPlanItem,
  validateWeeklyPlanItem,
  addWeeklyPlanItem,
  removeWeeklyPlanItem,
  updateWeeklyPlan,
  isValidEntityId,
  isValidWeekIdentifier,
  isValidDateString,
  isDateInWeek,
  createTimestamp,
} from '../../domain';
import {
  WeeklyPlanRepository,
  WeeklyPlanItemRepository,
  TaskRepository,
} from '../../data/repositories/interfaces';
import {
  ValidationError,
  NotFoundError,
  handleRepositoryError,
} from '../errors';
import {
  CreateWeeklyPlanInput,
  AddWeeklyPlanItemInput,
  UpdateWeeklyPlanItemInput,
} from '../types';

export class WeeklyPlanningService {
  constructor(
    private readonly planRepo: WeeklyPlanRepository,
    private readonly planItemRepo: WeeklyPlanItemRepository,
    private readonly taskRepo: TaskRepository
  ) {}

  /**
   * Creates and persists a new WeeklyPlan with optional initial items.
   */
  async createWeeklyPlan(input: CreateWeeklyPlanInput): Promise<WeeklyPlan> {
    const cleanWeek = input.weekIdentifier.trim();
    if (!isValidWeekIdentifier(cleanWeek)) {
      throw new ValidationError([
        `Invalid ISO week identifier "${input.weekIdentifier}". Format must be YYYY-Www (e.g. 2026-W38).`,
      ]);
    }

    // Verify if a plan already exists for this week
    const existing = await this.planRepo.getByWeekIdentifier(cleanWeek);
    if (existing) {
      throw new ValidationError([
        `A weekly plan already exists for week "${cleanWeek}". Duplicate plans for the same week are not permitted.`,
      ]);
    }

    // Verify task existence for all initial items
    if (input.items && input.items.length > 0) {
      for (const item of input.items) {
        if (!isValidEntityId(item.taskId)) {
          throw new ValidationError([`Invalid Task ID in plan item: "${item.taskId}".`]);
        }
        const task = await this.taskRepo.getById(item.taskId);
        if (!task) {
          throw new NotFoundError('Task', item.taskId);
        }
      }
    }

    const plan = createWeeklyPlan({
      weekIdentifier: cleanWeek,
      title: input.title,
      targetMinutes: input.targetMinutes,
      items: input.items,
    });

    const validation = validateWeeklyPlan(plan);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.planRepo.create(plan);
    } catch (err) {
      handleRepositoryError(err, `Failed to create Weekly Plan for week "${cleanWeek}".`);
    }
  }

  /**
   * Retrieves a WeeklyPlan by its primary ID, populated with its items.
   */
  async getWeeklyPlan(id: EntityId): Promise<WeeklyPlan> {
    if (!isValidEntityId(id)) {
      throw new ValidationError(['Weekly Plan ID must be a valid non-empty identifier.']);
    }

    let plan: WeeklyPlan | null;
    try {
      plan = await this.planRepo.getById(id);
    } catch (err) {
      handleRepositoryError(err, `Failed to fetch Weekly Plan "${id}".`);
    }

    if (!plan) {
      throw new NotFoundError('WeeklyPlan', id);
    }

    return plan;
  }

  /**
   * Retrieves a WeeklyPlan by its ISO week identifier (e.g. '2026-W38').
   */
  async getWeeklyPlanByWeek(weekIdentifier: string): Promise<WeeklyPlan | null> {
    const cleanWeek = weekIdentifier.trim();
    if (!isValidWeekIdentifier(cleanWeek)) {
      throw new ValidationError([
        `Invalid ISO week identifier "${weekIdentifier}". Format must be YYYY-Www.`,
      ]);
    }

    try {
      return await this.planRepo.getByWeekIdentifier(cleanWeek);
    } catch (err) {
      handleRepositoryError(err, `Failed to fetch Weekly Plan for week "${cleanWeek}".`);
    }
  }

  /**
   * Lists all Weekly Plans chronologically.
   */
  async listWeeklyPlans(): Promise<WeeklyPlan[]> {
    try {
      return await this.planRepo.getAll();
    } catch (err) {
      handleRepositoryError(err, 'Failed to list Weekly Plans.');
    }
  }

  /**
   * Adds an item (weekly commitment or daily allocation) to an existing WeeklyPlan.
   */
  async addWeeklyPlanItem(
    planId: EntityId,
    input: AddWeeklyPlanItemInput
  ): Promise<WeeklyPlan> {
    const plan = await this.getWeeklyPlan(planId);

    if (!isValidEntityId(input.taskId)) {
      throw new ValidationError(['Task ID must be a valid non-empty identifier.']);
    }

    const task = await this.taskRepo.getById(input.taskId);
    if (!task) {
      throw new NotFoundError('Task', input.taskId);
    }

    const cleanDate = input.targetDate ? input.targetDate.trim().split('T')[0] : undefined;
    if (cleanDate !== undefined) {
      if (!isValidDateString(cleanDate)) {
        throw new ValidationError([`Invalid target date: "${input.targetDate}". Format must be YYYY-MM-DD.`]);
      }
      if (!isDateInWeek(cleanDate, plan.weekIdentifier)) {
        throw new ValidationError([
          `Target date "${cleanDate}" does not fall within week "${plan.weekIdentifier}".`,
        ]);
      }
    }

    if (typeof input.plannedMinutes !== 'number' || isNaN(input.plannedMinutes) || input.plannedMinutes < 0) {
      throw new ValidationError(['Planned minutes must be a non-negative number.']);
    }

    // Check duplicate allocation in this plan
    const isDuplicate = plan.items.some((item) => {
      const matchTask = item.taskId === input.taskId;
      const matchDate =
        (item.targetDate === undefined && cleanDate === undefined) ||
        item.targetDate === cleanDate;
      return matchTask && matchDate;
    });

    if (isDuplicate) {
      throw new ValidationError([
        `An item for Task "${input.taskId}" with target date "${cleanDate ?? 'weekly'}" already exists in plan "${planId}".`,
      ]);
    }

    const updatedPlan = addWeeklyPlanItem(plan, {
      taskId: input.taskId,
      targetDate: cleanDate,
      plannedMinutes: input.plannedMinutes,
    });

    const validation = validateWeeklyPlan(updatedPlan);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.planRepo.update(updatedPlan);
    } catch (err) {
      handleRepositoryError(err, `Failed to add item to Weekly Plan "${planId}".`);
    }
  }

  /**
   * Updates an existing WeeklyPlanItem (minutes, date, or completion status).
   */
  async updateWeeklyPlanItem(
    planId: EntityId,
    itemId: EntityId,
    input: UpdateWeeklyPlanItemInput
  ): Promise<WeeklyPlan> {
    const plan = await this.getWeeklyPlan(planId);

    const targetItem = plan.items.find((i) => i.id === itemId);
    if (!targetItem) {
      throw new NotFoundError('WeeklyPlanItem', itemId);
    }

    const cleanDate =
      input.targetDate !== undefined
        ? input.targetDate
          ? input.targetDate.trim().split('T')[0]
          : undefined
        : targetItem.targetDate;

    if (cleanDate !== undefined) {
      if (!isValidDateString(cleanDate)) {
        throw new ValidationError([`Invalid target date: "${cleanDate}". Format must be YYYY-MM-DD.`]);
      }
      if (!isDateInWeek(cleanDate, plan.weekIdentifier)) {
        throw new ValidationError([
          `Target date "${cleanDate}" does not fall within week "${plan.weekIdentifier}".`,
        ]);
      }
    }

    const plannedMinutes =
      input.plannedMinutes !== undefined ? input.plannedMinutes : targetItem.plannedMinutes;
    if (typeof plannedMinutes !== 'number' || isNaN(plannedMinutes) || plannedMinutes < 0) {
      throw new ValidationError(['Planned minutes must be a non-negative number.']);
    }

    const updatedItems = plan.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            plannedMinutes,
            targetDate: cleanDate,
            isCompleted:
              input.isCompleted !== undefined ? input.isCompleted : item.isCompleted,
          }
        : item
    );

    const updatedPlan = updateWeeklyPlan(plan, {
      items: updatedItems,
    });

    const validation = validateWeeklyPlan(updatedPlan);
    if (!validation.isValid) {
      throw new ValidationError(validation.errors);
    }

    try {
      return await this.planRepo.update(updatedPlan);
    } catch (err) {
      handleRepositoryError(err, `Failed to update item "${itemId}" in Weekly Plan "${planId}".`);
    }
  }

  /**
   * Removes an item from a WeeklyPlan.
   */
  async removeWeeklyPlanItem(planId: EntityId, itemId: EntityId): Promise<WeeklyPlan> {
    const plan = await this.getWeeklyPlan(planId);

    const exists = plan.items.some((i) => i.id === itemId);
    if (!exists) {
      throw new NotFoundError('WeeklyPlanItem', itemId);
    }

    const updatedPlan = removeWeeklyPlanItem(plan, itemId);

    try {
      return await this.planRepo.update(updatedPlan);
    } catch (err) {
      handleRepositoryError(err, `Failed to remove item "${itemId}" from Weekly Plan "${planId}".`);
    }
  }

  /**
   * Deletes a WeeklyPlan and its associated items.
   */
  async deleteWeeklyPlan(id: EntityId): Promise<void> {
    await this.getWeeklyPlan(id);

    try {
      await this.planRepo.delete(id);
    } catch (err) {
      handleRepositoryError(err, `Failed to delete Weekly Plan "${id}".`);
    }
  }
}
