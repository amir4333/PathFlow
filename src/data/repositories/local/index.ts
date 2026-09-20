/**
 * Local Repositories Barrel & Factory
 */

export * from './dexieGoalRepository';
export * from './dexieRoadmapRepository';
export * from './dexieTaskRepository';
export * from './dexieSessionRepository';
export * from './dexieWeeklyPlanRepository';
export * from './dexieWeeklyPlanItemRepository';

import { PathFlowDB, getDatabase } from '../../local/database';
import { GoalRepository } from '../interfaces/goalRepository';
import { RoadmapRepository } from '../interfaces/roadmapRepository';
import { TaskRepository } from '../interfaces/taskRepository';
import { SessionRepository } from '../interfaces/sessionRepository';
import { WeeklyPlanRepository } from '../interfaces/weeklyPlanRepository';
import { WeeklyPlanItemRepository } from '../interfaces/weeklyPlanItemRepository';
import { DexieGoalRepository } from './dexieGoalRepository';
import { DexieRoadmapRepository } from './dexieRoadmapRepository';
import { DexieTaskRepository } from './dexieTaskRepository';
import { DexieSessionRepository } from './dexieSessionRepository';
import { DexieWeeklyPlanRepository } from './dexieWeeklyPlanRepository';
import { DexieWeeklyPlanItemRepository } from './dexieWeeklyPlanItemRepository';

export interface PathFlowRepositories {
  readonly goals: GoalRepository;
  readonly roadmaps: RoadmapRepository;
  readonly tasks: TaskRepository;
  readonly sessions: SessionRepository;
  readonly weeklyPlans: WeeklyPlanRepository;
  readonly weeklyPlanItems: WeeklyPlanItemRepository;
}

/**
 * Creates a complete suite of local repositories backed by the given PathFlowDB instance.
 */
export function createLocalRepositories(db: PathFlowDB = getDatabase()): PathFlowRepositories {
  return {
    goals: new DexieGoalRepository(db),
    roadmaps: new DexieRoadmapRepository(db),
    tasks: new DexieTaskRepository(db),
    sessions: new DexieSessionRepository(db),
    weeklyPlans: new DexieWeeklyPlanRepository(db),
    weeklyPlanItems: new DexieWeeklyPlanItemRepository(db),
  };
}
