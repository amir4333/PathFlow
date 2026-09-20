# PathFlow Domain Model Specification (Phase 2)

## Overview

The PathFlow Domain Layer encapsulates the core business concepts, relational rules, and progress calculations of the application. It is implemented in **pure TypeScript** with zero dependencies on React, UI components, IndexedDB, HTTP clients, or platform APIs.

---

## 1. Core Entities

### Goal
Represents a long-term outcome or strategic aspiration the user wants to achieve.
* **Fields**:
  * `id: EntityId` — Unique identifier.
  * `title: string` — Required non-empty string.
  * `description: string` — Optional context.
  * `status: GoalStatus` — Controlled status (`'not_started' | 'in_progress' | 'completed' | 'archived'`).
  * `createdAt: Timestamp` — ISO 8601 UTC creation time.
  * `updatedAt: Timestamp` — ISO 8601 UTC last modification time.

### Roadmap
Represents a structured, decomposed pathway toward a specific Goal.
* **Fields**:
  * `id: EntityId` — Unique identifier.
  * `goalId: EntityId` — ID reference to the parent Goal.
  * `title: string` — Required non-empty title.
  * `description: string` — Optional description.
  * `createdAt: Timestamp`
  * `updatedAt: Timestamp`
* **Modeling Decision**: A Roadmap references its parent Goal purely by ID (`goalId`). Goal data is not duplicated inside Roadmap.

### Task
Represents an actionable unit of work linked directly to a Roadmap.
* **Fields**:
  * `id: EntityId` — Unique identifier.
  * `roadmapId: EntityId` — ID reference to the parent Roadmap.
  * `title: string` — Required non-empty title.
  * `description: string` — Optional details.
  * `status: TaskStatus` — Controlled status (`'todo' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'`).
  * `priority: TaskPriority` — Controlled priority (`'low' | 'medium' | 'high' | 'urgent'`).
  * `estimatedMinutes: number` — Non-negative estimated effort duration.
  * `createdAt: Timestamp`
  * `updatedAt: Timestamp`
  * `completedAt?: Timestamp` — ISO timestamp set when marked completed; cleared if reopened.

### Session & Active Session
Represents discrete work execution on a Task.
* **ActiveSession**: An active, running timer on the user's device.
  * `id: EntityId` — Unique identifier.
  * `taskId: EntityId` — ID reference to the target Task worked on.
  * `startedAt: Timestamp` — ISO timestamp when work began.
  * *Constraint*: At most one ActiveSession exists at any time. Elapsed time is derived on demand without disk writes.
* **Session (Completed Historical Record)**:
  * `id: EntityId` — Unique identifier.
  * `taskId: EntityId` — ID reference to the target Task worked on.
  * `startedAt: Timestamp` — ISO timestamp when work began.
  * `endedAt: Timestamp` — ISO timestamp when work ended (`endedAt >= startedAt`).
  * `durationMinutes: number` — Non-negative elapsed minutes (derived from timestamps).
* **Modeling Decision**: A Session is an activity record, not a container that owns or nests a Task. A Task may have zero, one, or many historical Sessions. Sessions do not store redundant progress values.

### Weekly Plan
Represents tactical time and task allocation for a specific week.
* **Fields**:
  * `id: EntityId` — Unique identifier.
  * `weekIdentifier: string` — ISO week format (e.g., `'2026-W38'`).
  * `title: string` — Friendly week title.
  * `targetMinutes: number` — Non-negative target commitment for the week.
  * `items: WeeklyPlanItem[]` — Collection of planned allocations.
  * `createdAt: Timestamp`
  * `updatedAt: Timestamp`
* **WeeklyPlanItem Fields**:
  * `id: EntityId`
  * `weeklyPlanId: EntityId` — ID reference to the parent WeeklyPlan.
  * `taskId: EntityId` — References an existing Task by ID (no Task data duplication).
  * `targetDate?: string` — Optional ISO calendar date (e.g., `'2026-09-14'`). Omitted for flexible weekly-only commitments without specific daily allocation.
  * `plannedMinutes: number` — Non-negative planned duration.
  * `isCompleted: boolean`

---

## 2. Important Conceptual Distinctions

To prevent state synchronization anomalies and architectural bloat, the following concepts are strictly separated:

* **Task**: *What* needs to be accomplished (actionable unit of work).
* **Weekly Plan**: *When* and *how much* work is planned for a specific calendar week.
* **Session**: *What was actually executed*, when, and for how long (immutable event record).
* **Progress**: Dynamic information *derived* from source data (Tasks, Weekly Plans, Sessions).

---

## 3. Progress (Derived Calculation Services)

Progress is **not stored as a large mutable entity**. Instead, pure calculation functions dynamically derive metrics from source entities:

* `calculateTaskProgress(tasks: Task[])`: Computes task completion counts, ratios, and estimated minute totals. Safely handles empty collections (returns 0% without division-by-zero).
* `calculateSessionProgress(sessions: Session[])`: Aggregates total actual minutes and average session duration.
* `calculateWeeklyPlanProgress(plan: WeeklyPlan, sessions: Session[])`: Correlates planned items against actual sessions recorded for planned tasks, deriving item completion rates and planned vs. actual variance minutes.
* `calculateRoadmapProgress(roadmapId, tasks, sessions)`: Derives aggregated milestone velocity and time spent.
* `calculateGoalProgress(goalId, roadmaps, tasks, sessions)`: Derives strategic completion percentages across all underlying roadmaps and tasks.
* `calculateTaskActualMinutes / calculateRoadmapActualMinutes / calculateGoalActualMinutes`: Derives total actual recorded work time across hierarchy levels.
* `calculateDateActualMinutes / calculateWeekActualMinutes`: Derives total actual work time recorded on a given calendar day or ISO week.
* `compareTaskPlannedVsActual / compareWeeklyPlanPlannedVsActual / compareRoadmapPlannedVsActual / compareGoalPlannedVsActual`: Deterministic planned vs. actual comparisons returning variance minutes and consumption percentages.
* `calculateDailyActivitySummaries(sessions)`: Chronological daily buckets aggregating session counts and duration per task.


---

## 4. Domain Relationships

```text
Goal (1)
  └── Roadmap (N) [references goalId]
        └── Task (N) [references roadmapId]
              └── Session (N) [references taskId]

WeeklyPlan [references Task via item.taskId]
Progress [derived dynamically from Goal, Roadmap, Task, WeeklyPlan, Session]
```

All relationships use flat, immutable ID references (`EntityId`) rather than nested object trees.

---

## 5. Technical Strategies

### Identifier Strategy
* **Format**: Standard UUID v4 string (`EntityId = string`).
* **Generation**: Native `crypto.randomUUID()` with an RFC4122 v4 compliant fallback for universal compatibility across Node.js and browser environments.
* **Reasoning**:
  1. Fully supports **Offline-First** generation without requiring server coordination or network round-trips.
  2. Guarantees collision resistance across multi-device synchronizations (planned for Phase 4).
  3. Consistent across all domain entities (no divergent ID schemes).
  4. Requires zero third-party dependencies.

### Timestamp Strategy
* **Format**: ISO 8601 UTC string (`Timestamp = string`, e.g., `'2026-09-20T08:50:00.000Z'`).
* **Reasoning**:
  1. Standard JSON serializability across browser memory, IndexedDB, and future backend databases.
  2. Lexicographically sortable across strings.
  3. Timezone-neutral: explicit UTC representation (`Z`) prevents client timezone skew.
  4. Human-readable in tests, logs, and development inspection.

---

## 6. Domain Invariant Rules

1. **Title Invariants**: Goal, Roadmap, and Task titles cannot be empty or whitespace-only.
2. **Effort & Duration Invariants**: `estimatedMinutes`, `durationMinutes`, and `plannedMinutes` must be non-negative numbers.
3. **Session Chronology**: Session `endedAt` cannot precede `startedAt`.
4. **Task Completion Invariant**: A Task with status `'completed'` must have a valid `completedAt` timestamp. When transitioned back to `'todo'` or `'in_progress'`, `completedAt` is automatically cleared.
5. **Referential Integrity**: Child entities (Roadmap, Task, Session, WeeklyPlanItem) must specify valid, non-empty parent entity identifiers.
