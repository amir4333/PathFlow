# Data Layer — Repositories

This directory contains repository interfaces (`interfaces/`) and concrete local Dexie-backed implementations (`local/`) connecting domain logic to storage engines.

## Architectural Guidelines
* **Repository Pattern**: Mediates between domain models and data mapping layers without leaking storage mechanics.
* **Interface-Driven**: Presentation and application layers interact only with repository interfaces (e.g., `GoalRepository`, `TaskRepository`), ensuring complete decoupled mockability in unit tests.
* **Local-First Routing**: Queries resolve against local storage (IndexedDB) by default.
* **Phase Status**: **Implemented in Phase 3**. See `docs/persistence.md` for full documentation.
