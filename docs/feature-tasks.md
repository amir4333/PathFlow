# Feature Documentation: Task Management & Roadmap Integration (Phase 8B)

## Overview

The Task vertical slice completes the **Goal → Roadmap → Task** operational hierarchy in PathFlow. Tasks represent discrete, actionable work units linked directly to a milestone roadmap.

## Key Capabilities

1. **Roadmap-Embedded Task Management**:
   - Tasks are viewed and managed directly inside `RoadmapDetailView`.
   - Dedicated `TaskList` and `TaskCard` components provide responsive, high-density workflows.
   - Fast, low-friction task creation via `TaskFormModal` with sensible defaults (`todo` status, `medium` priority, 0 estimate minutes).

2. **Controlled Status Lifecycle**:
   - Statuses: `todo` → `in_progress` → `completed` | `blocked` | `cancelled`.
   - Transitions strictly enforce domain state machine rules via `TaskService.transitionTaskStatus`.
   - `completedAt` timestamp is automatically recorded upon completion and cleared upon reopening.
   - Quick one-click checkbox toggle allows instant completion / reopening.

3. **Priority & Time Estimation**:
   - Controlled priorities: `low`, `medium`, `high`, `urgent`.
   - Time estimates in minutes tracked against actual logged session deep work.

4. **Task Detail View**:
   - Accessible via client-side routing (`#tasks/:id` or `#tasks?id=...`).
   - Displays full strategic lineage (`Goal` → `Roadmap` → `Task`).
   - Shows derived time metrics (planned estimated time, actual logged session minutes, session counts, variance).

5. **Historical Data Integrity & Safety**:
   - Task deletion is guarded by domain dependency rules in `TaskService`.
   - Tasks with attached deep work sessions or weekly plan allocations cannot be deleted, preserving historical audit integrity.

6. **Progress Synchronization**:
   - Roadmap milestone progress dynamically computes total tasks, completed count, completion percentage, and estimated work using `ProgressService.getRoadmapProgress`.
   - Dashboard reflects real-time backlog and completed task counters.
