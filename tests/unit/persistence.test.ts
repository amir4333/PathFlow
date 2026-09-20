import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateEntityId,
  createGoal,
  createRoadmap,
  createTask,
  createSession,
  createWeeklyPlan,
  createWeeklyPlanItem,
  calculateTaskProgress,
  calculateSessionProgress,
  calculateWeeklyPlanProgress,
  calculateRoadmapProgress,
  calculateGoalProgress,
} from '../../src/domain';

import {
  PathFlowDB,
  createLocalRepositories,
  DomainValidationError,
  EntityNotFoundError,
  DependencyConstraintError,
} from '../../src/data';

function setupRepositories() {
  const dbName = `test-db-${generateEntityId()}`;
  const db = new PathFlowDB(dbName);
  const repos = createLocalRepositories(db);
  return { db, repos, dbName };
}

test('Persistence: Goal CRUD operations', async () => {
  const { db, repos } = setupRepositories();

  // Create
  const goal = createGoal({
    title: 'Master Systems Programming',
    description: 'Learn Rust, operating systems, and memory management',
  });
  const created = await repos.goals.create(goal);
  assert.equal(created.id, goal.id);

  // Read (getById)
  const fetched = await repos.goals.getById(goal.id);
  assert.ok(fetched);
  assert.equal(fetched.title, 'Master Systems Programming');
  assert.equal(fetched.status, 'not_started');

  // Read (getAll)
  const allGoals = await repos.goals.getAll();
  assert.equal(allGoals.length, 1);
  assert.equal(allGoals[0].id, goal.id);

  // Update
  const updatedGoal = {
    ...fetched,
    status: 'in_progress' as const,
    description: 'Active learning sprint',
  };
  const updated = await repos.goals.update(updatedGoal);
  assert.equal(updated.status, 'in_progress');

  const refetched = await repos.goals.getById(goal.id);
  assert.equal(refetched?.status, 'in_progress');
  assert.equal(refetched?.description, 'Active learning sprint');

  // Delete
  await repos.goals.delete(goal.id);
  const deleted = await repos.goals.getById(goal.id);
  assert.equal(deleted, null);

  await db.close();
});

test('Persistence: Normalized hierarchy (Goal -> Roadmap -> Task -> Session)', async () => {
  const { db, repos } = setupRepositories();

  // Goal
  const goal = await repos.goals.create(createGoal({ title: 'Game Development' }));

  // Roadmap referencing Goal
  const roadmap = await repos.roadmaps.create(
    createRoadmap({
      goalId: goal.id,
      title: 'Phase 1: Physics Engine',
    })
  );
  assert.equal(roadmap.goalId, goal.id);

  // Task referencing Roadmap
  const task = await repos.tasks.create(
    createTask({
      roadmapId: roadmap.id,
      title: 'Implement 2D SAT Collision Detection',
      priority: 'high',
      estimatedMinutes: 120,
    })
  );
  assert.equal(task.roadmapId, roadmap.id);

  // Session referencing Task
  const session = await repos.sessions.create(
    createSession({
      taskId: task.id,
      startedAt: '2026-09-20T10:00:00.000Z',
      endedAt: '2026-09-20T11:30:00.000Z',
    })
  );
  assert.equal(session.taskId, task.id);
  assert.equal(session.durationMinutes, 90);

  // Verify relational queries
  const roadmapsForGoal = await repos.roadmaps.getByGoalId(goal.id);
  assert.equal(roadmapsForGoal.length, 1);
  assert.equal(roadmapsForGoal[0].id, roadmap.id);

  const tasksForRoadmap = await repos.tasks.getByRoadmapId(roadmap.id);
  assert.equal(tasksForRoadmap.length, 1);
  assert.equal(tasksForRoadmap[0].id, task.id);

  const sessionsForTask = await repos.sessions.getByTaskId(task.id);
  assert.equal(sessionsForTask.length, 1);
  assert.equal(sessionsForTask[0].id, session.id);

  await db.close();
});

test('Persistence: WeeklyPlan and WeeklyPlanItem relationships and queries', async () => {
  const { db, repos } = setupRepositories();

  const goal = await repos.goals.create(createGoal({ title: 'Academic Success' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Algorithms' })
  );
  const task1 = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Graph Traversal (BFS & DFS)' })
  );
  const task2 = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Shortest Path (Dijkstra)' })
  );

  // Create plan with items
  const plan = createWeeklyPlan({
    weekIdentifier: '2026-W39',
    title: 'Sprint 39 Academic Focus',
    targetMinutes: 300,
    items: [
      createWeeklyPlanItem({
        taskId: task1.id,
        targetDate: '2026-09-21',
        plannedMinutes: 90,
      }),
      createWeeklyPlanItem({
        taskId: task2.id,
        targetDate: '2026-09-22',
        plannedMinutes: 120,
      }),
    ],
  });

  await repos.weeklyPlans.create(plan);

  // Fetch plan by weekIdentifier
  const fetchedPlan = await repos.weeklyPlans.getByWeekIdentifier('2026-W39');
  assert.ok(fetchedPlan);
  assert.equal(fetchedPlan.weekIdentifier, '2026-W39');
  assert.equal(fetchedPlan.targetMinutes, 300);
  assert.equal(fetchedPlan.items.length, 2);

  // Query items by plan ID
  const itemsByPlan = await repos.weeklyPlanItems.getByPlanId(fetchedPlan.id);
  assert.equal(itemsByPlan.length, 2);

  // Query items by task ID
  const itemsByTask = await repos.weeklyPlanItems.getByTaskId(task1.id);
  assert.equal(itemsByTask.length, 1);
  assert.equal(itemsByTask[0].taskId, task1.id);
  assert.equal(itemsByTask[0].plannedMinutes, 90);

  // Query items by date
  const itemsOnDate = await repos.weeklyPlanItems.getByDate('2026-09-21');
  assert.equal(itemsOnDate.length, 1);
  assert.equal(itemsOnDate[0].targetDate, '2026-09-21');

  // Update weekly plan item
  const itemToUpdate = itemsByPlan[0];
  const updatedItem = await repos.weeklyPlanItems.update({
    ...itemToUpdate,
    isCompleted: true,
  });
  assert.equal(updatedItem.isCompleted, true);

  const refetchedItem = await repos.weeklyPlanItems.getById(itemToUpdate.id);
  assert.equal(refetchedItem?.isCompleted, true);

  await db.close();
});

test('Persistence: Querying sessions by date range and task status filtering', async () => {
  const { db, repos } = setupRepositories();

  const goal = await repos.goals.create(createGoal({ title: 'Fullstack Mastery' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Backend' })
  );

  const tTodo = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Todo Task', status: 'todo' })
  );
  const tProgress = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Progress Task', status: 'in_progress' })
  );
  const tCompleted = await repos.tasks.create(
    createTask({
      roadmapId: roadmap.id,
      title: 'Done Task',
      status: 'completed',
      completedAt: '2026-09-20T12:00:00.000Z',
    })
  );

  // Filter tasks by status
  const todoTasks = await repos.tasks.getByStatus('todo');
  assert.equal(todoTasks.length, 1);
  assert.equal(todoTasks[0].id, tTodo.id);

  const inProgressTasks = await repos.tasks.getByStatus('in_progress');
  assert.equal(inProgressTasks.length, 1);
  assert.equal(inProgressTasks[0].id, tProgress.id);

  const completedTasks = await repos.tasks.getByStatus('completed');
  assert.equal(completedTasks.length, 1);
  assert.equal(completedTasks[0].id, tCompleted.id);

  // Sessions across different dates
  await repos.sessions.create(
    createSession({
      taskId: tProgress.id,
      startedAt: '2026-09-18T09:00:00.000Z',
      endedAt: '2026-09-18T09:45:00.000Z',
    })
  );
  await repos.sessions.create(
    createSession({
      taskId: tProgress.id,
      startedAt: '2026-09-20T10:00:00.000Z',
      endedAt: '2026-09-20T11:00:00.000Z',
    })
  );
  await repos.sessions.create(
    createSession({
      taskId: tCompleted.id,
      startedAt: '2026-09-20T14:00:00.000Z',
      endedAt: '2026-09-20T15:00:00.000Z',
    })
  );

  // Query date range for 2026-09-20 only
  const sept20Sessions = await repos.sessions.getByDateRange(
    '2026-09-20T00:00:00.000Z',
    '2026-09-20T23:59:59.999Z'
  );
  assert.equal(sept20Sessions.length, 2);

  // Query date range using date strings
  const sept18Sessions = await repos.sessions.getByDateRange('2026-09-18', '2026-09-18');
  assert.equal(sept18Sessions.length, 1);

  await db.close();
});

test('Persistence: Data survives closing and reopening database connection', async () => {
  const { db, repos, dbName } = setupRepositories();

  const goal = await repos.goals.create(createGoal({ title: 'Offline Resilience' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Phase 1: DB Survival' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Verify indexedDB survival', estimatedMinutes: 45 })
  );
  const session = await repos.sessions.create(
    createSession({
      taskId: task.id,
      startedAt: '2026-09-20T10:00:00.000Z',
      endedAt: '2026-09-20T10:45:00.000Z',
    })
  );

  // Close the database connection
  await db.close();

  // Open a new database instance pointing to the exact same database name
  const freshDb = new PathFlowDB(dbName);
  const freshRepos = createLocalRepositories(freshDb);

  const loadedGoal = await freshRepos.goals.getById(goal.id);
  assert.ok(loadedGoal);
  assert.equal(loadedGoal.title, 'Offline Resilience');

  const loadedRoadmaps = await freshRepos.roadmaps.getByGoalId(goal.id);
  assert.equal(loadedRoadmaps.length, 1);
  assert.equal(loadedRoadmaps[0].title, 'Phase 1: DB Survival');

  const loadedTasks = await freshRepos.tasks.getByRoadmapId(roadmap.id);
  assert.equal(loadedTasks.length, 1);
  assert.equal(loadedTasks[0].title, 'Verify indexedDB survival');

  const loadedSessions = await freshRepos.sessions.getByTaskId(task.id);
  assert.equal(loadedSessions.length, 1);
  assert.equal(loadedSessions[0].durationMinutes, 45);

  await freshDb.close();
});

test('Data Integrity: Invariant validation rejection on invalid repository writes', async () => {
  const { db, repos } = setupRepositories();

  // Empty title on Goal should throw DomainValidationError
  const invalidGoal = createGoal({ title: '   ' });
  await assert.rejects(
    () => repos.goals.create(invalidGoal),
    (err: unknown) => err instanceof DomainValidationError
  );

  // Negative duration on Task should throw DomainValidationError
  const validGoal = await repos.goals.create(createGoal({ title: 'Valid Goal' }));
  const validRoadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: validGoal.id, title: 'Valid Roadmap' })
  );

  const invalidTask = {
    ...createTask({ roadmapId: validRoadmap.id, title: 'Invalid Task' }),
    estimatedMinutes: -30,
  };
  await assert.rejects(
    () => repos.tasks.create(invalidTask),
    (err: unknown) => err instanceof DomainValidationError
  );

  // Illegal Task Status Transition should be rejected
  const task = await repos.tasks.create(
    createTask({ roadmapId: validRoadmap.id, title: 'State Machine Task' })
  );
  // Transition directly from todo to completed without completedAt or cancelled to completed
  const cancelledTask = {
    ...task,
    status: 'cancelled' as const,
  };
  await repos.tasks.update(cancelledTask);

  // Now attempt illegal transition from cancelled to completed
  const illegalTransition = {
    ...cancelledTask,
    status: 'completed' as const,
    completedAt: '2026-09-20T12:00:00.000Z',
  };
  await assert.rejects(
    () => repos.tasks.update(illegalTransition),
    (err: unknown) => err instanceof DomainValidationError
  );

  // Foreign key check: Task referencing non-existent Roadmap should fail
  const orphanTask = createTask({
    roadmapId: generateEntityId(),
    title: 'Orphan Task',
  });
  await assert.rejects(
    () => repos.tasks.create(orphanTask),
    (err: unknown) => err instanceof EntityNotFoundError
  );

  await db.close();
});

test('Data Integrity: Non-destructive deletion prevents accidental cascade of user history', async () => {
  const { db, repos } = setupRepositories();

  const goal = await repos.goals.create(createGoal({ title: 'Long-term Learning' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Core Foundations' })
  );
  const task = await repos.tasks.create(
    createTask({ roadmapId: roadmap.id, title: 'Study Module 1' })
  );
  const session = await repos.sessions.create(
    createSession({
      taskId: task.id,
      startedAt: '2026-09-20T10:00:00.000Z',
      endedAt: '2026-09-20T11:00:00.000Z',
    })
  );

  // Attempting to delete Goal when active Roadmaps exist must throw DependencyConstraintError
  await assert.rejects(
    () => repos.goals.delete(goal.id),
    (err: unknown) => err instanceof DependencyConstraintError
  );

  // Attempting to delete Roadmap when active Tasks exist must throw DependencyConstraintError
  await assert.rejects(
    () => repos.roadmaps.delete(roadmap.id),
    (err: unknown) => err instanceof DependencyConstraintError
  );

  // Attempting to delete Task when recorded Sessions exist must throw DependencyConstraintError
  await assert.rejects(
    () => repos.tasks.delete(task.id),
    (err: unknown) => err instanceof DependencyConstraintError
  );

  // Safe bottom-up deletion: Session can be deleted
  await repos.sessions.delete(session.id);
  // Now Task can be deleted
  await repos.tasks.delete(task.id);
  // Now Roadmap can be deleted
  await repos.roadmaps.delete(roadmap.id);
  // Now Goal can be deleted
  await repos.goals.delete(goal.id);

  const finalGoal = await repos.goals.getById(goal.id);
  assert.equal(finalGoal, null);

  await db.close();
});

test('Progress Calculation: Derived accurately from persisted source data', async () => {
  const { db, repos } = setupRepositories();

  const goal = await repos.goals.create(createGoal({ title: 'Game Engine Architecture' }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({ goalId: goal.id, title: 'Memory Allocators' })
  );

  const t1 = await repos.tasks.create(
    createTask({
      roadmapId: roadmap.id,
      title: 'Arena Allocator',
      status: 'completed',
      estimatedMinutes: 60,
      completedAt: '2026-09-20T10:00:00.000Z',
    })
  );
  const t2 = await repos.tasks.create(
    createTask({
      roadmapId: roadmap.id,
      title: 'Pool Allocator',
      status: 'in_progress',
      estimatedMinutes: 90,
    })
  );
  const t3 = await repos.tasks.create(
    createTask({
      roadmapId: roadmap.id,
      title: 'Stack Allocator',
      status: 'todo',
      estimatedMinutes: 30,
    })
  );

  const s1 = await repos.sessions.create(
    createSession({
      taskId: t1.id,
      startedAt: '2026-09-20T08:00:00.000Z',
      endedAt: '2026-09-20T09:00:00.000Z',
    })
  );
  const s2 = await repos.sessions.create(
    createSession({
      taskId: t2.id,
      startedAt: '2026-09-20T09:30:00.000Z',
      endedAt: '2026-09-20T10:15:00.000Z',
    })
  );

  // Load from repositories
  const allRoadmaps = await repos.roadmaps.getByGoalId(goal.id);
  const allTasks = await repos.tasks.getByRoadmapId(roadmap.id);
  const allSessions = [
    ...(await repos.sessions.getByTaskId(t1.id)),
    ...(await repos.sessions.getByTaskId(t2.id)),
    ...(await repos.sessions.getByTaskId(t3.id)),
  ];

  // Derive task progress
  const taskProgress = calculateTaskProgress(allTasks);
  assert.equal(taskProgress.totalTasks, 3);
  assert.equal(taskProgress.completedTasks, 1);
  assert.equal(taskProgress.inProgressTasks, 1);
  assert.equal(taskProgress.completionPercentage, 33);
  assert.equal(taskProgress.totalEstimatedMinutes, 180);

  // Derive session progress
  const sessionProgress = calculateSessionProgress(allSessions);
  assert.equal(sessionProgress.totalSessions, 2);
  assert.equal(sessionProgress.totalActualMinutes, 105);

  // Derive roadmap progress
  const roadmapProgress = calculateRoadmapProgress(roadmap.id, allTasks, allSessions);
  assert.equal(roadmapProgress.roadmapId, roadmap.id);
  assert.equal(roadmapProgress.taskSummary.completedTasks, 1);
  assert.equal(roadmapProgress.sessionSummary.totalActualMinutes, 105);

  // Derive goal progress
  const goalProgress = calculateGoalProgress(goal.id, allRoadmaps, allTasks, allSessions);
  assert.equal(goalProgress.goalId, goal.id);
  assert.equal(goalProgress.totalRoadmaps, 1);
  assert.equal(goalProgress.taskSummary.completionPercentage, 33);
  assert.equal(goalProgress.sessionSummary.totalActualMinutes, 105);

  await db.close();
});

test('Real-World Scenario: Game Systems Lab roadmap structure and planned vs. actual tracking', async () => {
  const { db, repos } = setupRepositories();

  // Goal: Game Systems Lab
  const goal = await repos.goals.create(
    createGoal({
      title: 'Game Systems Lab',
      description: 'Systematic laboratory for modular RPG systems',
    })
  );

  // Roadmap: Inventory System
  const roadmap = await repos.roadmaps.create(
    createRoadmap({
      goalId: goal.id,
      title: 'Inventory System',
      description: 'Grid, slots, stacking, and weight calculation',
    })
  );

  // Tasks: Design API, Implement stacking, Handle edge cases, Write tests, Documentation
  const taskNames = [
    'Design API',
    'Implement stacking',
    'Handle edge cases',
    'Write tests',
    'Documentation',
  ];
  const createdTasks = [];
  for (const name of taskNames) {
    const t = await repos.tasks.create(
      createTask({
        roadmapId: roadmap.id,
        title: name,
        estimatedMinutes: 60,
      })
    );
    createdTasks.push(t);
  }
  assert.equal(createdTasks.length, 5);

  // Plan week with planned vs actual work
  const weeklyPlan = await repos.weeklyPlans.create(
    createWeeklyPlan({
      weekIdentifier: '2026-W39',
      title: 'Game Systems Sprint 1',
      targetMinutes: 240,
      items: [
        createWeeklyPlanItem({
          taskId: createdTasks[0].id, // Design API
          targetDate: '2026-09-22',
          plannedMinutes: 60,
        }),
        createWeeklyPlanItem({
          taskId: createdTasks[1].id, // Implement stacking
          targetDate: '2026-09-23',
          plannedMinutes: 90,
        }),
      ],
    })
  );

  // Actual deep work sessions
  const s1 = await repos.sessions.create(
    createSession({
      taskId: createdTasks[0].id,
      startedAt: '2026-09-22T14:00:00.000Z',
      endedAt: '2026-09-22T15:15:00.000Z', // 75 min (planned 60)
    })
  );
  const s2 = await repos.sessions.create(
    createSession({
      taskId: createdTasks[1].id,
      startedAt: '2026-09-23T09:00:00.000Z',
      endedAt: '2026-09-23T10:00:00.000Z', // 60 min (planned 90)
    })
  );

  // Calculate weekly progress with planned vs actual separation
  const planProgress = calculateWeeklyPlanProgress(weeklyPlan, [s1, s2]);
  assert.equal(planProgress.totalPlannedMinutes, 150); // 60 + 90
  assert.equal(planProgress.totalActualMinutes, 135); // 75 + 60
  assert.equal(planProgress.varianceMinutes, -15); // 135 - 150 = -15 min

  // Verify that unfinished tasks remain accessible in roadmap
  const allInventoryTasks = await repos.tasks.getByRoadmapId(roadmap.id);
  const unfinishedTasks = allInventoryTasks.filter((t) => t.status !== 'completed');
  assert.equal(unfinishedTasks.length, 5, 'All 5 tasks remain available for scheduling');

  await db.close();
});

test('Real-World Scenario: Academic Learning content progress (Data Structures Chapter 1-3)', async () => {
  const { db, repos } = setupRepositories();

  const goal = await repos.goals.create(createGoal({ title: "Master's Preparation" }));
  const roadmap = await repos.roadmaps.create(
    createRoadmap({
      goalId: goal.id,
      title: 'Data Structures & Algorithms',
    })
  );

  const academicTasks = [
    'Chapter 1: Asymptotic Analysis',
    'Chapter 2: Linear Data Structures',
    'Chapter 3: Trees & Hierarchical Structures',
    'Exercises Set A',
    'Midterm Review',
  ];
  const tasks = [];
  for (const title of academicTasks) {
    tasks.push(
      await repos.tasks.create(
        createTask({
          roadmapId: roadmap.id,
          title,
          estimatedMinutes: 90,
        })
      )
    );
  }

  // Complete Chapter 1 and Chapter 2
  await repos.tasks.update({
    ...tasks[0],
    status: 'completed',
    completedAt: '2026-09-18T16:00:00.000Z',
  });
  await repos.tasks.update({
    ...tasks[1],
    status: 'completed',
    completedAt: '2026-09-19T18:00:00.000Z',
  });

  // Verify content-level progress reflects exactly which material has been completed
  const currentTasks = await repos.tasks.getByRoadmapId(roadmap.id);
  const completedTitles = currentTasks
    .filter((t) => t.status === 'completed')
    .map((t) => t.title)
    .sort();

  assert.deepEqual(completedTitles, [
    'Chapter 1: Asymptotic Analysis',
    'Chapter 2: Linear Data Structures',
  ]);

  const summary = calculateTaskProgress(currentTasks);
  assert.equal(summary.completedTasks, 2);
  assert.equal(summary.totalTasks, 5);
  assert.equal(summary.completionPercentage, 40);

  await db.close();
});
