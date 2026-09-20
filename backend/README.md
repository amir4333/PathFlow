# Backend Architecture (Future Phases)

This directory is reserved for future server-side service implementations (e.g., Node.js / PostgreSQL / REST or GraphQL sync API).

## Strict Phase 1 Rule
In Phase 1, **no backend code is introduced**. PathFlow is founded strictly as a local-first system.

## Planned Responsibilities in Future Phases:
1. **Relational Database**: PostgreSQL schema for durable cloud backup and multi-device state coordination.
2. **Delta Sync API**: Endpoint accepting batches of client mutations and returning server-side changesets since a client cursor.
3. **Teacher Portal Service**: Read-only APIs and authentication allowing designated teachers or mentors to inspect student progress.
4. **Decoupled Architecture**: Backend will remain an auxiliary synchronization target; the client frontend must always function completely offline without an active backend.
