# PathFlow Weekly Planning Specification (Phase 5)

## Overview

The Weekly Planning System establishes PathFlow's tactical execution mechanism. It bridges long-term aspirations (Goals and Roadmaps) with day-to-day actions (Tasks and Sessions) by allowing users to define time and task commitments for specific ISO 8601 calendar weeks.

Like all PathFlow systems, Weekly Planning is designed with an **offline-first**, **pure domain architecture**:
* Decoupled from React, UI state, and rendering cycles.
* Decoupled from backend servers and remote APIs.
* Fully persistent in local IndexedDB via Dexie repositories.
* Unified across both **Academic Learning** and **Game Systems Lab** without divergent schemas or architectural bifurcation.

---

## 1. Core Domain Models

### `WeeklyPlan` (Aggregate Root)
Represents the planned commitments for a single, distinct ISO 8601 week.

* **Fields**:
  * `id: EntityId` — Unique UUID v4 identifier.
  * `weekIdentifier: string` — ISO 8601 week string, e.g. `'2026-W38'`.
  * `title: string` — Human-readable title, e.g. `'Sprint 38 Commitments'`.
  * `targetMinutes: number` — Target effort capacity in minutes for the week (defaults to sum of planned items if omitted).
  * `items: readonly WeeklyPlanItem[]` — Collection of planned commitments.
  * `createdAt: Timestamp` — ISO 8601 UTC creation time.
  * `updatedAt: Timestamp` — ISO 8601 UTC last modification time.

### `WeeklyPlanItem` (Entity)
Represents a planned time commitment on a specific Task.

* **Fields**:
  * `id: EntityId` — Unique UUID v4 identifier.
  * `weeklyPlanId: EntityId` — Reference to parent `WeeklyPlan`.
  * `taskId: EntityId` — Reference to the target `Task` (no duplicate task data).
  * `targetDate?: string` — Optional calendar date in `YYYY-MM-DD` format (e.g. `'2026-09-14'`).
  * `plannedMinutes: number` — Non-negative planned duration.
  * `isCompleted: boolean` — Whether this specific planned commitment was achieved.

---

## 2. Supported Planning Styles

PathFlow accommodates different planning workflows without requiring different schemas:

### A. Weekly-Only Planning (Flexible Commitments)
* An item is defined with **no `targetDate`** (`targetDate === undefined`).
* Represents a commitment to invest `N` minutes on a task at some point during the week.
* Suitable for long-term study, exploratory lab research, or reading goals where rigid day scheduling adds unnecessary friction.

### B. Daily Allocation Planning (Structured Scheduling)
* An item specifies a **valid `targetDate`** (e.g. `'2026-09-14'`).
* Represents a commitment to work on a task on a specific calendar day.
* The system validates that `targetDate` falls strictly within the Monday–Sunday boundary of the plan's `weekIdentifier`.

### C. Mixed / Hybrid Planning
* A single `WeeklyPlan` can contain both daily allocations and weekly unallocated commitments.
* A single task can have multiple daily allocations (e.g., 60 minutes on Monday, 45 minutes on Wednesday, 60 minutes on Friday) alongside an unallocated reserve.

### D. Multi-Week Task Planning
* A task can be scheduled across multiple distinct weeks (e.g., Week 38, Week 39, Week 40).
* Each week maintains an independent planning record; previous weeks remain completely untouched when new weeks are planned or updated.

---

## 3. Strict Domain Invariants & Validation

Validation rules in `src/domain/rules/validation.ts` guarantee data integrity across all environments:

1. **Valid Week Identifier**:
   * Must match ISO 8601 format: `YYYY-Www` where `ww` is between `01` and `53` (e.g. `2026-W38`).
2. **Valid Task References**:
   * Every item must reference a valid, non-empty `taskId`.
3. **Non-Negative Durations**:
   * `plannedMinutes` and `targetMinutes` must be numbers `>= 0`.
4. **Valid Calendar Dates**:
   * When `targetDate` is specified, it must be a valid calendar date (`YYYY-MM-DD`), preventing impossible dates such as February 30th or leap year errors.
5. **Week Boundary Conformance**:
   * If `targetDate` is provided, `getWeekIdentifier(targetDate)` must equal `plan.weekIdentifier`. Items cannot be assigned to dates outside the plan's week.
6. **No Duplicate Allocations**:
   * A plan cannot contain multiple records for the exact same task on the exact same `targetDate`.
   * A plan cannot contain multiple unallocated records for the same task. Users must consolidate minutes into a single planned item.
7. **Unique Item IDs**:
   * All items within an aggregate must have unique identifiers.

---

## 4. Planned vs. Actual Calculations (Avoiding Double-Counting)

PathFlow maintains a strict architectural separation between **intended planning** and **actual execution**:

| Concept | Entity | Storage | Mutability |
| :--- | :--- | :--- | :--- |
| **Intended Work** | `WeeklyPlan` / `WeeklyPlanItem` | `weeklyPlans`, `weeklyPlanItems` | Editable by user |
| **Actual Work** | `Session` | `sessions` | Append-only historical events |
| **Progress / Variance** | `WeeklyProgressSummary` | Derived dynamically on demand | Pure function output |

### Key Calculation Rules:
1. **No Double-Counting**:
   * Planned minutes are summed across plan items.
   * Actual minutes are derived by summing completed `Session` records where `session.taskId` matches a planned task and `session.startedAt` falls within the plan's ISO week.
   * Actual sessions do NOT modify planned minutes; planned minutes do NOT generate phantom sessions.
2. **Task Completion vs. Time Completion**:
   * **Task Completion**: Percentage of planned tasks that have been finished (`task.status === 'completed'`).
   * **Time Completion**: Percentage of planned minutes that have been logged via sessions (`(actualMinutes / plannedMinutes) * 100`).
   * **Early Completion**: A task finished in 45 minutes when 120 minutes were planned yields 100% task completion and 38% time completion without error.
   * **Overtime Completion**: A task that required 90 minutes when 60 minutes were planned yields 150% time completion and positive variance (+30m).
3. **Daily Breakdown**:
   * `calculateWeeklyPlanDailyBreakdown(plan)` compiles a full 7-day Monday–Sunday schedule, calculating date-by-date planned totals while cleanly isolating unallocated commitments.

---

## 5. Historical Preservation

* Plans for different weeks are strictly independent records.
* Moving into a new week never overwrites or resets previous weekly plans.
* Modifying a plan preserves its original `createdAt` timestamp and only updates `updatedAt`.
* Updating or deleting a weekly plan never mutates or deletes completed historical `Session` activity logs.

---

## 6. Persistence & Querying

The Dexie-backed persistence layer (`DexieWeeklyPlanRepository` and `DexieWeeklyPlanItemRepository`) provides indexed querying for local, offline-first execution:

* `getByWeekIdentifier(weekIdentifier: string)`: Retrieves the plan and its child items for any given ISO week.
* `getByTaskId(taskId: EntityId)`: Finds all weekly plans that contain planned commitments for a task.
* `getItemsByPlanId(planId: EntityId)`: Retrieves all planned items belonging to a plan.
* `getByDate(date: string)`: Retrieves all daily scheduled items across the database for a specific calendar day.
* `getUnallocatedByPlanId(planId: EntityId)`: Retrieves flexible weekly items not tied to a calendar date.

---

## 7. Unified Domain Architecture

PathFlow supports diverse domains without schema fragmentation:

* **Academic Learning**: e.g., Goal: *"Master Computer Science"*, Task: *"Binary Search Trees"*, planned for 90 minutes on Monday.
* **Game Systems Lab**: e.g., Goal: *"Game Systems Lab Engineering"*, Task: *"Spatial Grid Query Optimization"*, planned for 120 minutes on Tuesday.

Both goals, roadmaps, and tasks coexist seamlessly within the same `WeeklyPlan`. Domain calculation services (`calculateGoalPlannedMinutesInPlan`, `calculateRoadmapPlannedMinutesInPlan`) allow isolated tracking per goal or roadmap while maintaining a single, unified weekly schedule.
