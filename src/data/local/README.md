# Data Layer — Local

This directory contains the offline-first local persistence implementation backed by Dexie.js and IndexedDB.

## Architectural Guidelines
* **Target Storage**: IndexedDB via Dexie.js (`PathFlowDB`).
* **Local-First Principle**: All user write operations commit locally first, providing immediate feedback regardless of network state.
* **Schema Evolution**: Version 1 schema and stores are defined in `schema.ts`.
* **Phase Status**: **Implemented in Phase 3**. See `docs/persistence.md` for full documentation.
