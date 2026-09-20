# Data Layer — Local

This directory will contain the offline-first local persistence implementation.

## Architectural Guidelines
* **Target Storage**: IndexedDB (using a lightweight wrapper such as `idb` or Dexie when introduced in Phase 2/3).
* **Local-First Principle**: All user write operations commit locally first, providing immediate feedback regardless of network state.
* **Schema Evolution**: Local database migrations and table definitions will reside here.
* **Phase Status**: Placeholder for Phase 2/3 local persistence implementation.
