/**
 * Application Services Container & Factory
 *
 * Provides dependency wiring for the Application Layer.
 * Allows easy construction with test doubles or production Dexie repositories.
 * Completely free of global state, Dexie imports, or React hooks.
 */

import { ApplicationRepositories } from './types';
import { GoalService } from './goals/goalService';
import { RoadmapService } from './roadmaps/roadmapService';
import { TaskService } from './tasks/taskService';
import { SessionService } from './sessions/sessionService';
import { WeeklyPlanningService } from './weekly-plans/weeklyPlanningService';
import { ProgressService } from './progress/progressService';

export interface ApplicationServices {
  readonly goals: GoalService;
  readonly roadmaps: RoadmapService;
  readonly tasks: TaskService;
  readonly sessions: SessionService;
  readonly weeklyPlans: WeeklyPlanningService;
  readonly progress: ProgressService;
}

/**
 * Creates and wires all application services using the provided repository implementations.
 */
export function createApplicationServices(
  repositories: ApplicationRepositories
): ApplicationServices {
  const goalService = new GoalService(repositories.goals, repositories.roadmaps);
  const roadmapService = new RoadmapService(
    repositories.roadmaps,
    repositories.goals,
    repositories.tasks
  );
  const taskService = new TaskService(
    repositories.tasks,
    repositories.roadmaps,
    repositories.sessions,
    repositories.weeklyPlanItems
  );
  const sessionService = new SessionService(
    repositories.sessions,
    repositories.tasks,
    repositories.roadmaps
  );
  const weeklyPlanningService = new WeeklyPlanningService(
    repositories.weeklyPlans,
    repositories.weeklyPlanItems,
    repositories.tasks
  );
  const progressService = new ProgressService(
    repositories.goals,
    repositories.roadmaps,
    repositories.tasks,
    repositories.sessions,
    repositories.weeklyPlans
  );

  return {
    goals: goalService,
    roadmaps: roadmapService,
    tasks: taskService,
    sessions: sessionService,
    weeklyPlans: weeklyPlanningService,
    progress: progressService,
  };
}
