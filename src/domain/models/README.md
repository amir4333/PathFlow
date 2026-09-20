# Domain Layer — Models

This directory is reserved for core business entities and aggregate definitions (e.g., Goal, Roadmap, Task, Session, TimeRecord, Review).

## Architectural Guidelines
* **Pure TypeScript**: No React hooks, UI references, or DOM dependencies.
* **Phase 2 Scope**: Entity definitions, immutable value objects, and domain types will be designed and implemented in Phase 2.
* **No Database Assumptions**: Domain models represent pure business concepts, decoupled from database storage schemes or remote wire formats.
