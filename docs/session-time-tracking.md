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

---

## 6. Phase 9A: Active Session / Timer UI

Phase 9A exposes the underlying Session & Time Tracking engine to users through an intuitive, persistent, offline-first active timer interface:

1. **ActiveSessionTimer Component (`src/features/sessions/ActiveSessionTimer.tsx`)**:
   - Reusable timer card supporting both full and compact views.
   - When idle, provides a target task selector with quick estimate indicators and a "Start Session" action.
   - When active, displays a live ticking clock (MM:SS / HH:MM:SS), running status beacon, started timestamp, task details, and "Stop & Save" / "Discard" controls.

2. **ActiveSessionContext (`src/features/sessions/ActiveSessionContext.tsx`)**:
   - Provides global active session state across the application shell.
   - Restores the active session from IndexedDB immediately on mount or browser refresh.
   - Derives elapsed seconds directly from `startedAt` timestamps using domain utilities rather than purely synthetic state increments, guaranteeing accuracy across tab backgrounding and refreshes.
   - Prevents multi-session conflicts and updates all observing components upon state transitions.

3. **Integrated Navigation & UI Placements**:
   - **Header (`src/components/layout/Header.tsx`)**: Displays an ambient, pulsing live timer ticker accessible from any page.
   - **Dashboard (`src/features/dashboard/DashboardView.tsx`)**: Shows an active focus session card and quick navigation to the timer.
   - **Task Detail (`src/features/tasks/TaskDetailView.tsx`)**: Allows direct timer invocation from specific tasks.
   - **Sessions View (`src/features/sessions/SessionsView.tsx`)**: Dedicated session hub featuring the timer and immutable completed session history.

---

## 7. Phase 9B: Manual Session Entry

Phase 9B allows users to record completed work sessions executed offline or without running the active live timer:

1. **ManualSessionModal (`src/features/sessions/ManualSessionModal.tsx`)**:
   - Form allowing selection of an existing Task, Start Time, and End Time using local datetime pickers.
   - Automatically derives and displays duration in real time without requiring manual duration entry.
   - Enforces active session conflict safeguards: prevents recording conflicting manual sessions while a live timer is running, displaying an informative warning banner without automatically terminating the running timer.
   - Validates that end time succeeds start time, timestamps are valid ISO dates, duration is positive (>= 1 minute), and sessions do not start in the future.

2. **SessionService Extension (`src/application/sessions/sessionService.ts`)**:
   - `createManualSession(input)`: Validates task existence, checks for active session conflict (`ActiveSessionConflictError`), validates timestamps and duration constraints, constructs the immutable domain `Session`, and persists via `SessionRepository`.
   - `getSession(sessionId)`: Provides direct single-session lookups.

3. **UI Integration**:
   - **Sessions View (`src/features/sessions/SessionsView.tsx`)**: Provides "Log Manual Session" actions in the view header, empty state, and history list. Immediately refreshes session history upon creation.
   - **Task Detail View (`src/features/tasks/TaskDetailView.tsx`)**: Allows quick logging of past sessions directly associated with a specific task.

---

## 8. Phase 9C-1: Session History & Filtering Core

Phase 9C-1 introduces robust historical query filtering and aggregate summary capabilities in the Application service layer:

1. **Filtering Model (`SessionHistoryFilter`)**:
   - Date range bounds (`startDate`, `endDate`) normalized to exact whole-day ISO UTC boundaries (`00:00:00.000Z` to `23:59:59.999Z`).
   - Task filtering (`taskId`).
   - Roadmap hierarchy filtering (`roadmapId`), matching all tasks belonging to the selected roadmap.
   - Compound combinations combining date bounds, roadmap, and task selectors.

2. **Application Query Service (`SessionService.querySessionHistory`)**:
   - Derives total session count, total focused minutes, and `{ hours, minutes }` breakdown.
   - Sorts results deterministically newest first (`startedAt` descending, `id` descending tie-breaker).
   - Keeps domain models and Dexie storage pure ISO UTC, avoiding backend calendar entanglement.

---

## 9. Phase 9C-2: Session History UX & Daily Grouping

Phase 9C-2 delivers an intuitive, calendar-aware daily grouped presentation layer for completed sessions:

1. **Daily Grouping (`src/features/sessions/sessionGrouping.ts`)**:
   - `groupSessionsByDay(sessions, preferences, referenceDate)`: Pure presentation derivation that buckets completed sessions by calendar day.
   - Derives calendar day keys (`dateKey`) dynamically using the user's active calendar preference (Gregorian or Persian / Jalali).
   - Generates per-day aggregate summaries (`sessionCount`, `totalMinutes`, `formattedTotalTime`, `formattedSessionCount`).
   - Computes contextual relative day markers ("Today" / "Yesterday" or "امروز" / "دیروز") alongside exact calendar dates.

2. **Session Row & Card UX (`src/features/sessions/SessionsView.tsx`)**:
   - Compact display: Task title, Roadmap association badge, Done completion indicator, start-to-end time range (`14:10 → 15:30`), and duration badge (`1h 20m` / `۱ ساعت و ۲۰ دقیقه`).
   - Responsive layout adapting gracefully from wide desktop monitors to narrow mobile viewports without horizontal overflow.
   - Retains global filtered aggregate summary alongside per-day summaries.
   - Clear distinction between "No sessions recorded yet" and "No sessions match the selected filters" with one-click filter reset.
   - Respects independent 4-way matrix of Language (en / fa) and Calendar (Gregorian / Persian) preferences.



