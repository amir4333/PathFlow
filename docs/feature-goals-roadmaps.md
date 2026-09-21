# Feature Slice: Strategic Goals & Milestone Roadmaps UI

## 1. Overview
This document describes the architectural implementation and user interface integration for the **Strategic Goals** and **Milestone Roadmaps** vertical slice in PathFlow.

The implementation strictly honors PathFlow's layered architecture:
```
Presentation / UI (React 18 + Tailwind CSS + Lucide Icons)
       ↓
Application Layer (GoalService, RoadmapService, ProgressService)
       ↓
Domain Layer (Pure models, validation rules, progress review aggregators)
       ↓
Repository Layer (Dexie / IndexedDB local persistence)
```

No artificial mock layers, server stubs, or placeholder bypasses are used. All views interact exclusively with the verified Application Layer services (`useApplication()`).

---

## 2. Implemented Capabilities

### 2.1 Strategic Goals UI
- **List View (`GoalListView`)**:
  - Fetches all persisted goals directly from `GoalService.listGoals()`.
  - Filter by lifecycle status: `All`, `Not Started`, `In Progress`, `Completed`, `Archived`.
  - Displays count of attached milestone roadmaps dynamically retrieved from `RoadmapService`.
  - Computes and displays real derived task velocity and logged actual minutes using `ProgressService.getGoalProgress(goalId)`.
  - Supports frictionless creation via modal with title and optional description.
  - Supports editing goal title, description, and status.
  - Supports archiving goals safely.
  - Clicking any goal card navigates to the detailed Goal view (`#goals/:id`).

- **Goal Detail View (`GoalDetailView`)**:
  - Displays full goal metadata: title, description, ID, creation date, and last updated timestamp.
  - Visual status pill and action buttons to edit or archive the goal.
  - Summary metrics grid derived from `ProgressService.getGoalProgress(goalId)`:
    - Milestone Roadmaps completed vs. total.
    - Tasks Velocity percentage (`completedTasks / activeTasks`).
    - Actual minutes invested in deep work sessions.
    - Estimated planned minutes.
  - List of child milestone roadmaps attached to this goal.
  - Capability to create new milestone roadmaps directly under this parent goal.
  - Capability to edit or delete milestone roadmaps (subject to task dependency integrity checks).
  - Clean empty state with quick action button when no roadmaps are attached yet.

### 2.2 Milestone Roadmaps UI
- **List View (`RoadmapListView`)**:
  - Displays all milestone roadmaps across the workspace.
  - Shows parent Goal association and live progress indicators.
  - Navigation directly to detailed roadmap view (`#roadmaps/:id`).

- **Roadmap Detail View (`RoadmapDetailView`)**:
  - Displays roadmap milestone title, description, ID, creation date, and last updated timestamp.
  - Parent Goal breadcrumb allowing instantaneous navigation back to the parent Goal.
  - Summary metrics derived from `ProgressService.getRoadmapProgress(roadmapId)`:
    - Task velocity percentage and completion count.
    - Active / In Progress task count.
    - Actual minutes invested across session logs.
    - Total estimated work minutes.
  - Action button to edit roadmap details.
  - **Milestone Action Units & Tasks Section**: Clean, non-fake placeholder explicitly documenting that Task management will be integrated in the upcoming feature slice.

### 2.3 Dashboard Integration
- Enhanced Dashboard live metrics cards with real portfolio numbers:
  - Active Goals (`activeGoals / totalGoals`).
  - Milestone Roadmaps count (`totalRoadmaps`).
  - Total deep work logged in minutes across all sessions.
  - Backlog tasks count.
  - Direct navigation clicks from dashboard stat cards straight into the Goals and Roadmaps views.

### 2.4 Dynamic Client-Side Router
- Hash-based router (`RouterProvider.tsx`) extended to parse dynamic path parameters without external libraries:
  - Supports `#goals/:id` and `#roadmaps/:id`.
  - Provides active `params` map (`params.id`) to consuming views.
  - Header breadcrumbs automatically reflect dynamic route context and active entity IDs.

---

## 3. Dependency and Integrity Rules
- **Relational Integrity**:
  - Creating a Roadmap requires a valid `goalId`.
  - A Goal cannot be deleted while dependent Roadmaps exist (`DependencyConstraintError`).
  - A Roadmap cannot be deleted while dependent Tasks exist (`DependencyConstraintError`).
- **Progress Derivation**:
  - Progress percentages and actual times are derived purely from child tasks and recorded sessions. No manual percentage overwrites are permitted.

---

## 4. Test Verification
All vertical slice capabilities are tested in `tests/unit/goalsRoadmapsSlice.test.ts` and `tests/unit/application.test.ts`:
- Goal creation with minimal friction and default status (`not_started`).
- Goal editing preserving ID and creation timestamp.
- Goal status transitions and archiving.
- Roadmap creation under parent goal and listing by goal.
- Deletion dependency enforcement for Goal → Roadmap and Roadmap → Task.
- Pure derived progress calculations through `ProgressService`.
- Zero-dependency router path parameter parsing.
- 100% test pass rate (77/77 tests passing).
