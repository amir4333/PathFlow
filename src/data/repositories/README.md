# Data Layer — Repositories

This directory contains repository interfaces and their concrete implementations connecting domain logic to local and remote data sources.

## Architectural Guidelines
* **Repository Pattern**: Mediates between domain models and data mapping layers.
* **Interface-Driven**: Domain services interact only with repository interfaces (e.g., `GoalRepository`, `TaskRepository`), ensuring full mockability in unit tests.
* **Local-First Routing**: Queries resolve against local storage (IndexedDB) by default.
* **Phase Status**: Interfaces and adapters will be introduced in Phase 2.
