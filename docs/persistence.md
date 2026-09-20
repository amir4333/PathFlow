# PathFlow Local Persistence & Repository Layer (Phase 3)

## 1. Overview & Architectural Principles

PathFlow's Phase 3 implements the **Local Persistence and Repository Layer**, providing durable, offline-first storage so that all domain entities survive:
* Page reloads
* Browser restarts
* Offline work sessions
* Temporary loss of network connectivity

The persistence layer respects the strict architectural boundaries established in Phase 1 and Phase 2:
```text
┌─────────────────────────────────────────────────────────┐
│ Presentation Layer (React components & feature hooks)   │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ Domain Models & Pure Calculation Services (src/domain)  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ Repository Interfaces (src/data/repositories/interfaces)│
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ Local Dexie Repositories (src/data/repositories/local)  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ IndexedDB Storage Engine (Dexie.js — PathFlowDB)        │
└─────────────────────────────────────────────────────────┘
```

The presentation layer and UI never access IndexedDB directly; all data reads and mutations flow through type-safe, storage-agnostic repository interfaces.

---

## 2. Chosen Persistence Technology: Dexie.js

**Dexie.js** was chosen as the IndexedDB abstraction layer because:
1. **Lightweight & Standards-Compliant**: Built directly on native browser IndexedDB without heavy runtime overhead.
2. **Robust Secondary Indexing**: Efficient B-tree index queries (`where`, `equals`, `between`, `orderBy`) mapped directly to domain lookup patterns.
3. **ACID Transaction Support**: Atomically writes aggregate roots and child items (e.g., WeeklyPlan headers and associated WeeklyPlanItems) in a single transaction.
4. **Isomorphic Testability**: Seamlessly executes in headless Node.js test runners using `fake-indexeddb` without requiring browser DOM emulation or complex mocking.

---

## 3. Local Database Schema (v1)

The IndexedDB schema is defined in `src/data/local/schema.ts` and managed by `PathFlowDB` (`src/data/local/database.ts`):

* **Database Name**: `PathFlowDB`
* **Version**: `1`

### Stores and Indexes

| Store Name | Primary Key | Secondary Indexes | Description |
| :--- | :--- | :--- | :--- |
| `goals` | `id` | `status, createdAt` | Long-term user goals |
| `roadmaps` | `id` | `goalId, createdAt` | Milestone roadmaps under a Goal |
| `tasks` | `id` | `roadmapId, status, priority, createdAt` | Actionable work units |
| `sessions` | `id` | `taskId, startedAt, endedAt` | Historical execution session logs |
| `weeklyPlans` | `id` | `weekIdentifier, createdAt` | Weekly tactical commitment headers |
| `weeklyPlanItems` | `id` | `weeklyPlanId, taskId, targetDate` | Discrete planned task allocations |

---

## 4. Repository Architecture & Contracts

Every aggregate has a dedicated repository interface defining asynchronous CRUD operations and domain-specific query methods:

### Interfaces (`src/data/repositories/interfaces/`)
* `GoalRepository`: `create`, `getById`, `getAll`, `update`, `delete`
* `RoadmapRepository`: `create`, `getById`, `getAll`, `getByGoalId`, `update`, `delete`
* `TaskRepository`: `create`, `getById`, `getAll`, `getByRoadmapId`, `getByStatus`, `update`, `delete`
* `SessionRepository`: `create`, `getById`, `getByTaskId`, `getByDateRange`, `update`, `delete`
* `WeeklyPlanRepository`: `create`, `getById`, `getByWeekIdentifier`, `getAll`, `update`, `delete`
* `WeeklyPlanItemRepository`: `create`, `getById`, `getByPlanId`, `getByTaskId`, `getByDate`, `update`, `delete`

### Factory & Dependency Injection
Repositories can be instantiated individually with any `PathFlowDB` instance or created as a complete container via `createLocalRepositories(db)`. This ensures clean isolation in integration tests and straightforward dependency injection in application providers.

---

## 5. Normalized Entity Relationships

PathFlow models relationships using **normalized scalar identifiers (`EntityId`)** rather than nested document graphs:

* **Goal → Roadmap**: `Roadmap.goalId` references `Goal.id`.
* **Roadmap → Task**: `Task.roadmapId` references `Roadmap.id`.
* **Task → Session**: `Session.taskId` references `Task.id`.
* **WeeklyPlan → WeeklyPlanItem → Task**:
  * `WeeklyPlanItem.weeklyPlanId` references `WeeklyPlan.id`.
  * `WeeklyPlanItem.taskId` references `Task.id`.
  * No duplication of Task description, title, or status occurs inside WeeklyPlanItem.

---

## 6. Why Planned Time vs. Actual Time Are Separated

A core design principle of PathFlow is the **strict separation between intention and reality**:

1. **Intention (Planned Time)**:
   * Expressed on `Task.estimatedMinutes` (initial sizing).
   * Allocated on `WeeklyPlanItem.plannedMinutes` and `WeeklyPlan.targetMinutes` (tactical scheduling).
2. **Reality (Actual Time)**:
   * Recorded only via `Session.durationMinutes`, `startedAt`, and `endedAt` (immutable execution events).
3. **Derived Progress & Variance**:
   * Progress calculation services (`calculateWeeklyPlanProgress`, `calculateTaskProgress`) correlate planned items with executed sessions to derive variance (`actualMinutes - plannedMinutes`), velocity, and completion ratios.
   * Modifying a plan never modifies historical execution logs, and recording a session never alters planned commitments.

---

## 7. Data Integrity & Invariant Enforcement

Repositories enforce domain rules before writing to IndexedDB:
1. **Domain Validation**: Every create and update operation calls domain validation rules (`validateGoal`, `validateTask`, etc.). If invalid, a `DomainValidationError` is raised.
2. **Referential Existence**: Creating or updating child entities (Roadmaps, Tasks, Sessions, WeeklyPlanItems) verifies that the parent entity exists, raising `EntityNotFoundError` if missing.
3. **State Transition Integrity**: Updating a `Task` verifies that any status change conforms to legal state machine transitions (`canTransitionTaskStatus`). Illegal transitions (e.g. `cancelled` → `completed`) are rejected.

---

## 8. Delete Behavior & Non-Destructive Protection

To protect historical learning velocity and teacher review records, **destructive cascading deletion is strictly forbidden**:

* Attempting to delete a `Goal` that still contains active `Roadmaps` throws `DependencyConstraintError`.
* Attempting to delete a `Roadmap` that still contains active `Tasks` throws `DependencyConstraintError`.
* Attempting to delete a `Task` that has recorded `Sessions` or planned `WeeklyPlanItems` throws `DependencyConstraintError`.
* Attempting to delete a `WeeklyPlan` with active `WeeklyPlanItems` throws `DependencyConstraintError`.

Users must explicitly clean up or reassign dependent entities before removing parent structural containers.

---

## 9. Intentionally Deferred to Phase 4

Phase 3 is strictly scoped to local persistence. The following capabilities are explicitly deferred to Phase 4 (Synchronization Layer):
* Mutation queueing and replay engines (`src/sync/queue/`)
* Remote REST/GraphQL sync endpoints
* Cross-device conflict resolution (Lamport clocks / LWW)
* PostgreSQL backend persistence
* PWA service workers and background sync triggers
