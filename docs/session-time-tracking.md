# Session & Time Tracking Specification (Phase 4)

This document specifies the Session lifecycle, Active Session management, time aggregation, and planned-vs-actual comparison engine established in Phase 4 of PathFlow.

---

## 1. Overview & Philosophy

A **Session** in PathFlow represents an actual, discrete period of deep work performed on a Task. 
The core time-tracking philosophy adheres to the following principles:

1. **Record Reality**: Sessions record actual work performed rather than forcing complex manual logging.
2. **Offline-First Resilience**: Sessions start, tick, complete, and persist locally in IndexedDB without external network requirements.
3. **Derived Metrics**: Elapsed time and aggregates are derived deterministically from timestamp boundaries rather than continuously written to disk every second.
4. **Historical Preservation**: Completed sessions are immutable historical logs. Deleting tasks or roadmaps is blocked if dependent session records exist, protecting the user's logged execution history.
5. **Unified Domain Pipeline**: Academic learning (e.g., Data Structures, Logic Circuits) and structured engineering (e.g., Game Systems Lab) use the identical `Goal → Roadmap → Task → Session` architecture.

---

## 2. Session Lifecycle & Active Session Model

PathFlow distinguishes between an **active/running session** and a **completed historical session**:

```
[Task Selected] 
       │
       ▼
startActiveSession(taskId, startedAt)
       │  (Persists to activeSession store; enforces singleton)
       ▼
   [RUNNING] ──▶ calculateActiveSessionElapsedMinutes(activeSession, now)
       │         (Derived dynamically on demand; zero disk churn)
       ├────────────────────────────────────────┐
       ▼                                        ▼
stopActiveSession(endedAt)              discardActiveSession()
       │                                        │
       ▼                                        ▼
Validate end >= start,                  [Active session cleared]
derive durationMinutes,                 (No historical record created)
atomic tx: add to sessions,
clear activeSession
       │
       ▼
[Completed Historical Session]
(Persisted immutably in IndexedDB)
```

### 2.1 Active Session Rules
* **Device Singleton**: At most **one** active session can exist at any given time on the device/browser.
* **Conflict Prevention**: Attempting to call `startActiveSession` while an active session is already running throws an `ActiveSessionConflictError`, referencing the active `taskId`.
* **Zero Interval Churn**: An active session only writes once on start. Timers in the UI or background calculate elapsed time on demand via `calculateActiveSessionElapsedMinutes(activeSession, asOf)` or `calculateActiveSessionElapsedSeconds(activeSession, asOf)`.
* **Crash & Refresh Survival**: The active session is stored in IndexedDB (`activeSession` store). If the user closes the browser or reloads the tab, the active session is restored on launch and continues tracking elapsed time from its original `startedAt` timestamp.

### 2.2 Stopping & Completing a Session
When stopping an active session:
1. `endedAt` defaults to `createTimestamp()` if not provided.
2. Time range validation guarantees `endedAt >= startedAt`. If `endedAt < startedAt`, a `DomainValidationError` is thrown and the session is not stopped.
3. `durationMinutes` is derived using `calculateDurationMinutes(startedAt, endedAt)`.
4. An atomic IndexedDB transaction writes the completed `Session` to the `sessions` store and removes the record from `activeSession`.

### 2.3 Manual Session Recording
Users who study or work offline away from PathFlow can record completed sessions directly:
```typescript
const session = createManualSession({
  taskId: 'task-data-structures',
  startedAt: '2026-09-20T10:00:00.000Z',
  endedAt: '2026-09-20T11:30:00.000Z',
});
await repos.sessions.create(session);
```
Manual sessions undergo full entity validation (`validateSession`) and referenced foreign-key checks (`taskId`) before persistence.

---

## 3. Query Capabilities

The `SessionRepository` interface provides focused, index-backed retrieval methods:

| Method | Target Use Case | Index Utilized |
| :--- | :--- | :--- |
| `getById(id)` | Single session lookup | `id` (Primary Key) |
| `getAll()` | Global historical review | `startedAt` |
| `getByTaskId(taskId)` | Task-specific history | `taskId` |
| `getByDateRange(start, end)` | Arbitrary date window queries | `startedAt` (between) |
| `getByDate(date)` | Single-day activity log (YYYY-MM-DD) | `startedAt` (between) |
| `getByWeek(weekIdentifier)` | ISO week activity log (YYYY-Www) | `startedAt` (between) |
| `getActiveSession()` | Active running session retrieval | `activeSession` store |

---

## 4. Time Aggregation & Calculation Services

All session time aggregations are **pure TypeScript domain services** in `src/domain/services/timeTracking.ts`. Aggregate values are derived on demand rather than redundantly stored in mutable entity records.

### 4.1 Aggregation Functions
* `calculateTaskActualMinutes(taskId, sessions)`: Total actual minutes for a specific task.
* `calculateRoadmapActualMinutes(roadmapId, tasks, sessions)`: Total actual minutes across all tasks in a roadmap.
* `calculateGoalActualMinutes(goalId, roadmaps, tasks, sessions)`: Total actual minutes across all roadmaps and tasks in a goal.
* `calculateWeeklyPlanActualMinutes(plan, sessions)`: Total actual minutes spent on tasks scheduled in a weekly plan.
* `calculateDateActualMinutes(date, sessions)`: Total actual minutes recorded across all sessions on a given calendar day.
* `calculateWeekActualMinutes(weekIdentifier, sessions)`: Total actual minutes recorded across all sessions in an ISO week.

Invalid or corrupted sessions (negative duration, unparseable dates) are filtered out automatically, ensuring calculations remain resilient.

### 4.2 Planned vs. Actual Comparisons
`compareTaskPlannedVsActual`, `compareWeeklyPlanPlannedVsActual`, `compareRoadmapPlannedVsActual`, and `compareGoalPlannedVsActual` produce a structured comparison:

```typescript
export interface PlannedVsActualComparison {
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  /** Variance: actual - planned (positive = overtime, negative = remaining under budget) */
  readonly varianceMinutes: number;
  /** Percentage of planned time consumed */
  readonly percentage: number;
}
```

### 4.3 Historical Daily Activity Summary
`calculateDailyActivitySummaries(sessions)` organizes raw historical session logs into chronological calendar day buckets (`DailyActivitySummary`), breaking down time and session counts per task. This powers historical review, streak analysis, and academic/project reporting.

---

## 5. Architectural Boundaries

```
Presentation Layer (React / UI)
       │  (Invokes start/stop actions, reads summaries)
       ▼
Application / Feature Services
       │  (Coordinates repositories and domain models)
       ▼
Domain Layer (`src/domain/`)
       │  (Models: Session, ActiveSession; Services: timeTracking, validation; Pure TypeScript)
       ▼
Data Layer (`src/data/`)
       │  (SessionRepository interface, DexieSessionRepository implementation)
       ▼
Local Storage (IndexedDB via Dexie.js `PathFlowDB`)
```

* The **Domain Layer** has 0 dependencies on React, browser DOM, or storage implementations.
* The **Repository Layer** guarantees validation before writes and isolates storage engines behind clean interfaces.
* The **UI Layer** never directly communicates with IndexedDB.
