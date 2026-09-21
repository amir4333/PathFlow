# PathFlow Application Layer Specification (Phase 7)

## Overview

The **Application Layer** (`src/application/`) serves as the mediator between PathFlow's presentation layer (React components and hooks) and the underlying domain models, invariant rules, and persistence repositories.

```text
┌─────────────────────────────────────────────────────────────┐
│ Presentation Layer (React Views, Components, Hooks)         │
│ src/features/, src/components/                              │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Calls Application Services via useApplication)
┌──────────────────────────────▼──────────────────────────────┐
│ Application Layer (Service Orchestration, DTOs, Invariants)  │
│ src/application/                                            │
│   ├── goals/            ├── weekly-plans/                   │
│   ├── roadmaps/         ├── progress/                       │
│   ├── tasks/            ├── errors.ts                       │
│   ├── sessions/         ├── types.ts                        │
│                         └── services.ts (Composition Root)  │
└──────────────┬──────────────────────────────┬───────────────┘
               │ (Delegates business rules)   │ (Fetches & persists entities)
┌──────────────▼──────────────┐ ┌─────────────▼───────────────┐
│ Domain Layer                │ │ Data Layer                  │
│ (Entities, Rules, Calculators)│ (Repository Interfaces & IDB) │
│ src/domain/                 │ │ src/data/                   │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## Architectural Principles

1. **Presentation Decoupling**: React components do NOT directly manipulate database tables, invoke Dexie methods, or execute multi-step domain validation routines. All user operations go through high-level application service methods (e.g., `services.tasks.createTask(...)`, `services.sessions.startSession(...)`).
2. **Domain Boundary Preservation**: Application services do not redefine domain calculations. Instead, they coordinate:
   - Reading primary entities from repositories (`GoalRepository`, `TaskRepository`, etc.).
   - Passing inputs into pure domain factories, invariant validators, and calculation services (`validateWeeklyPlan`, `calculateWeeklyReviewSummary`, etc.).
   - Persisting valid updates back through repository contracts.
3. **Structured Error Hierarchy**: Standardized error classes (`ValidationError`, `NotFoundError`, `ConflictError`, `InvalidStateTransitionError`, `ApplicationError`) translate lower-level exceptions into predictable, typed failure states.
4. **Dependency Injection**: Services are instantiated via a composition root factory `createApplicationServices(repositories)`. In production, repositories talk to local IndexedDB via Dexie (`PathFlowDB`); in unit tests, in-memory repository instances backed by `fake-indexeddb` enable rapid, deterministic testing without browser overhead.
5. **No Redundant Cached Progress State**: Following the Phase 6 progress design, `ProgressService` computes all summary metrics dynamically on-demand from primary entities (Sessions, Tasks, Roadmaps, Goals, Weekly Plans) without persisting intermediate progress snapshots.

---

## Service Catalog

### 1. `GoalService` (`src/application/goals/goalService.ts`)
Orchestrates high-level aspirations and strategic goals.
- `createGoal(input)`: Validates and persists new goals with default `not_started` status.
- `getGoal(id)`: Retrieves single goal or throws `NotFoundError`.
- `listGoals()`: Fetches all goals.
- `updateGoal(id, input)`: Modifies title, description, or status with domain validation.
- `deleteGoal(id)`: Cascading integrity validation; prevents deleting goals with attached roadmaps unless explicitly handled.

### 2. `RoadmapService` (`src/application/roadmaps/roadmapService.ts`)
Manages roadmap milestones attached to parent Goals.
- `createRoadmap(input)`: Verifies parent goal existence, validates title, and creates roadmap.
- `getRoadmap(id)`: Retrieves single roadmap.
- `listRoadmapsByGoal(goalId)`: Fetches roadmaps filtered by goal.
- `updateRoadmap(id, input)`: Updates title, description, or status.
- `deleteRoadmap(id)`: Prevents deletion if active tasks are linked to the roadmap.

### 3. `TaskService` (`src/application/tasks/taskService.ts`)
Handles actionable work units and lifecycle state transitions.
- `createTask(input)`: Ensures roadmap existence, validates priority and estimated minutes.
- `getTask(id)`: Retrieves single task.
- `listTasks(filter)`: Queries tasks by roadmap, status, or priority.
- `updateTask(id, input)`: Modifies task properties.
- `transitionTaskStatus(id, targetStatus)`: Enforces domain state transition graph (`todo` ↔ `in_progress` → `completed` / `blocked` / `cancelled`), managing `completedAt` timestamps automatically.
- `deleteTask(id)`: Removes task and prevents orphan sessions where applicable.

### 4. `SessionService` (`src/application/sessions/sessionService.ts`)
Coordinates deep-work timer tracking and manual historical session entry.
- `getActiveSession()`: Returns current active timer or null.
- `startSession(taskId)`: Enforces active timer singleton invariant (rejects starting if another session is running).
- `stopActiveSession(notes)`: Derives elapsed duration dynamically from start timestamp, clears active timer, and writes completed historical session record.
- `discardActiveSession()`: Cancels running timer without recording time.
- `createManualSession(input)`: Logs past historical work sessions with start and end timestamps.
- `getSessionsByDateRange(startDate, endDate)`: Queries historical sessions for review.

### 5. `WeeklyPlanningService` (`src/application/weekly-plans/weeklyPlanningService.ts`)
Orchestrates weekly planning commitments, daily allocations, and duplicate protection.
- `createWeeklyPlan(input)`: Creates or fetches plan for target ISO week (`YYYY-Www`).
- `getWeeklyPlan(id)` / `getWeeklyPlanByWeek(weekIdentifier)`: Retrieves plan by ID or ISO week.
- `listWeeklyPlans()`: Queries all plans.
- `addWeeklyPlanItem(planId, input)`: Adds commitment; validates week date boundaries (`isDateInWeek`) and prevents duplicate task allocations on the same date.
- `updateWeeklyPlanItem(planId, itemId, input)`: Adjusts planned minutes, targets, or completion status.
- `removeWeeklyPlanItem(planId, itemId)`: Drops commitment from plan.
- `deleteWeeklyPlan(id)`: Deletes weekly plan aggregate.

### 6. `ProgressService` (`src/application/progress/progressService.ts`)
Computes real-time and historical analytics across arbitrary horizons.
- `getDailyProgress(date?)`: Daily progress summary comparing planned commitments with recorded sessions.
- `getWeeklyProgress(weekIdentifier?)`: Weekly review with roadmap and goal progress breakdown.
- `getProgressForDateRange(range)`: Chronological time series and daily aggregations.
- `getRoadmapProgress(roadmapId)`: Detailed task-level progress and time variance for a roadmap.
- `getGoalProgress(goalId)`: Deep hierarchical rollup across all roadmaps and tasks under a goal.
- `getProjectHistory(asOfDate?)`: Non-destructive historical project reconstruction.
- `getProgressReviewReport(options?)`: Comprehensive executive report for student self-audits and teacher reviews.

---

## UI Integration Pattern

The UI interacts with application services through the `ApplicationProvider` React context:

```tsx
import { useApplication } from './app/providers/ApplicationProvider';

export function DashboardSummary() {
  const { services } = useApplication();
  const [daily, setDaily] = useState<DailyProgressSummary | null>(null);

  useEffect(() => {
    services.progress.getDailyProgress().then(setDaily);
  }, [services]);

  // render metrics...
}
```

The provider exposes a singleton `ApplicationServices` bundle backed by the persistent Dexie repositories.
