/**
 * Application Layer Types & DTOs
 *
 * Defines input contracts and repository dependencies for application use cases.
 * 100% independent of React, DOM, or storage backends.
 */

import {
  EntityId,
  GoalStatus,
  TaskStatus,
  TaskPriority,
  Timestamp,
  CreateWeeklyPlanItemParams,
} from '../domain';
import {
  GoalRepository,
  RoadmapRepository,
  TaskRepository,
  SessionRepository,
  WeeklyPlanRepository,
  WeeklyPlanItemRepository,
} from '../data/repositories/interfaces';

export interface ApplicationRepositories {
  readonly goals: GoalRepository;
  readonly roadmaps: RoadmapRepository;
  readonly tasks: TaskRepository;
  readonly sessions: SessionRepository;
  readonly weeklyPlans: WeeklyPlanRepository;
  readonly weeklyPlanItems: WeeklyPlanItemRepository;
}

export interface CreateGoalInput {
  readonly title: string;
  readonly description?: string;
  readonly status?: GoalStatus;
}

export interface UpdateGoalInput {
  readonly title?: string;
  readonly description?: string;
  readonly status?: GoalStatus;
}

export interface CreateRoadmapInput {
  readonly goalId: EntityId;
  readonly title: string;
  readonly description?: string;
}

export interface UpdateRoadmapInput {
  readonly title?: string;
  readonly description?: string;
  readonly goalId?: EntityId;
}

export interface CreateTaskInput {
  readonly roadmapId: EntityId;
  readonly title: string;
  readonly description?: string;
  readonly status?: TaskStatus;
  readonly priority?: TaskPriority;
  readonly estimatedMinutes?: number;
}

export interface UpdateTaskInput {
  readonly title?: string;
  readonly description?: string;
  readonly status?: TaskStatus;
  readonly priority?: TaskPriority;
  readonly estimatedMinutes?: number;
  readonly roadmapId?: EntityId;
}

export interface CreateManualSessionInput {
  readonly taskId: EntityId;
  readonly startedAt: Timestamp;
  readonly endedAt: Timestamp;
  readonly notes?: string;
}

export interface CreateWeeklyPlanInput {
  readonly weekIdentifier: string;
  readonly title?: string;
  readonly targetMinutes?: number;
  readonly items?: readonly CreateWeeklyPlanItemParams[];
}

export interface AddWeeklyPlanItemInput {
  readonly taskId: EntityId;
  readonly targetDate?: string;
  readonly plannedMinutes: number;
}

export interface UpdateWeeklyPlanItemInput {
  readonly plannedMinutes?: number;
  readonly targetDate?: string;
  readonly isCompleted?: boolean;
}
