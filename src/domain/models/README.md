# Domain Layer — Models

This directory is reserved for core business entities and aggregate definitions (e.g., Goal, Roadmap, Task, Session, TimeRecord, Review).

## Architectural Guidelines
* **Pure TypeScript**: No React hooks, UI references, or DOM dependencies.
* **Implemented (Phase 2)**: Contains entity models and factories:
  * `Goal` (`goal.ts`)
  * `Roadmap` (`roadmap.ts`)
  * `Task` (`task.ts`)
  * `Session` (`session.ts`)
  * `WeeklyPlan` & `WeeklyPlanItem` (`weeklyPlan.ts`)
* **No Database Assumptions**: Domain models represent pure business concepts, decoupled from database storage schemes or remote wire formats. All references use explicit `EntityId` values rather than deeply nested mutable objects.
