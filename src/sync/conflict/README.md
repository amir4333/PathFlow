# Sync Layer — Conflict Resolution

This directory will contain conflict detection and resolution strategies for multi-device data convergence.

## Architectural Guidelines
* **Deterministic Resolution**: Strategies like Last-Write-Wins (LWW) with Lamport timestamps or Field-Level Merging where appropriate.
* **Tombstones & Soft Deletes**: Deletions are tracked with tombstones to prevent resurrecting deleted records during sync.
* **Auditability**: Conflicts and merge decisions are traceable.
* **Phase Status**: Placeholder for synchronization phase.
