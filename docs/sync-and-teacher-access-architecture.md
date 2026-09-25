# PathFlow Synchronization & Teacher Access Architecture Specification

## 1. Executive Summary & Vision

PathFlow is founded on a **local-first, offline-first** paradigm. The user is a self-directed student or developer who plans, focuses, and reflects on their computer or mobile device without requiring constant network connectivity.

As PathFlow scales to support **multi-device continuity** (laptop at desk, mobile on the go) and **mentorship oversight** (teacher/advisor review), the architectural challenge is to enable seamless data synchronization and remote read-only teacher access **without compromising offline resilience, data integrity, or student privacy**.

This document defines the architectural specification for Phase 14A:
1. **Data Ownership & Boundary Model**: Explicit segregation of student data, local preferences, and teacher views.
2. **Synchronization Architecture**: Local-first mutation outbox, delta synchronization, stable UUIDs, and tombstones.
3. **Conflict Resolution Strategy**: Deterministic rules governing concurrent updates across all entity types.
4. **Teacher Access & Authorization**: Student-granted, cryptographically verifiable, strictly read-only remote access.

---

## 2. Real Product Requirements & Actors

```text
┌─────────────────────────────────────────────────────────────┐
│                      STUDENT ACTOR                          │
│                                                             │
│   • Uses PathFlow primarily on laptop (deep planning/focus) │
│   • Uses mobile for quick session capture & review          │
│   • Functions 100% offline; network is an enhancement       │
│   • Generates scoped read-only access grants for mentors    │
└──────────────┬──────────────────────────────▲───────────────┘
               │ Local-First Writes           │ Delta Sync
               ▼                              │
┌─────────────────────────────────────────────────────────────┐
│                   LOCAL PATHFLOW CLIENT                     │
│  React UI → App Services → Local IndexedDB + Sync Outbox    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Push Mutations / Pull Deltas
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   REMOTE SYNC & CLOUD DB                    │
│   • Validates student authentication                        │
│   • Applies mutations idempotently to central student store │
│   • Exposes incremental changeset feed via sync cursors     │
│   • Enforces read-only access grants for teachers           │
└──────────────────────────────▲──────────────────────────────┘
                               │
                               │ Read-Only Scoped Queries
                               │ (Zero Mutation Access)
┌──────────────────────────────┴──────────────────────────────┐
│                      TEACHER ACTOR                          │
│                                                             │
│   • Accesses student progress via authorized Grant Token    │
│   • Observes Goals, Roadmaps, Tasks, Sessions, & Plans      │
│   • Enjoys real-time/on-demand read-only teacher dashboard  │
│   • CANNOT create, update, or delete any student entities   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Layered Architectural Placement

The sync system integrates cleanly between the Application and Data layers, maintaining strict decoupling:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Presentation Layer (React UI, TeacherView, ReportsView)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Calls application services
┌───────────────────────────────────▼────────────────────────────────────┐
│ 2. Application Layer (GoalService, TaskService, ProgressService, etc.) │
└─────────────────┬──────────────────────────────────┬───────────────────┘
                  │ Read/Write Entities              │ Enqueue Mutations
┌─────────────────▼──────────────────┐ ┌─────────────▼───────────────────┐
│ 3. Data Layer (Dexie Repositories) │ │ 4. Sync Layer                   │
│    IndexedDB:                      │ │    • SyncOutbox (durable queue) │
│    - goals, roadmaps, tasks        │ │    • ConflictResolver           │
│    - sessions, weeklyPlans         │ │    • SyncEngine                 │
│    - weeklyPlanItems               │ │    • TeacherAccessManager       │
└─────────────────┬──────────────────┘ └─────────────┬───────────────────┘
                  │                                  │ Push / Pull Deltas
                  │                    ┌─────────────▼───────────────────┐
                  │                    │ 5. Remote Sync API Client       │
                  │                    │    (Network boundary)           │
                  └────────────────────┼─────────────────────────────────┘
                                       │
                                       ▼ (Future Cloud Gateway)
```

### Architectural Invariants:
1. **Zero UI Direct Sync**: React components never call sync engines directly; all user interactions flow through Application Services.
2. **Local Commit Precedence**: Every write operation completes immediately in local storage. Sync is asynchronous and non-blocking.
3. **Pure Domain Cleanliness**: Domain models (`Goal`, `Task`, `Session`, `WeeklyPlan`) remain pure TypeScript and are not polluted with transport-specific metadata. Sync metadata is encapsulated in **Sync Envelopes** and **Outbox Records**.

---

## 4. Entity Ownership & Mutability Matrix

| Entity Type | Owner | Local Storage | Sync Scope | Teacher Access | Conflict Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Goal** | Student | IndexedDB | Cloud Sync | **Read-Only** | Last-Write-Wins (LWW) via `updatedAt` |
| **Roadmap** | Student | IndexedDB | Cloud Sync | **Read-Only** | Last-Write-Wins (LWW) via `updatedAt` |
| **Task** | Student | IndexedDB | Cloud Sync | **Read-Only** | LWW with field merge (status vs content) |
| **Session** | Student | IndexedDB | Cloud Sync | **Read-Only** | **Append-Only / Immutable Execution Log** |
| **WeeklyPlan** | Student | IndexedDB | Cloud Sync | **Read-Only** | Plan-level target capacity LWW |
| **WeeklyPlanItem** | Student | IndexedDB | Cloud Sync | **Read-Only** | Item-level granular LWW (avoids plan clobbering) |
| **UserPreferences** | Device/User | LocalStorage | **Local Only** | **No Access** | Device-specific (Language & Calendar) |
| **TeacherGrant** | Student | IndexedDB | Cloud Sync | **Read-Only Verification** | Student revocation takes immediate precedence |

---

## 5. Synchronization Model & Protocol

### 5.1 Stable Client-Generated Identifiers
All PathFlow entities use UUID v4 strings (`EntityId`) generated client-side via `generateEntityId()`.
* **Advantage**: Entities created offline on any device have guaranteed unique identifiers.
* **No ID Mapping**: No translation between "temporary client IDs" and "permanent server IDs" is required.

### 5.2 Outbox Pattern (Change Tracking)
When an entity is created, modified, or deleted locally, a `SyncMutation` record is appended to the durable `SyncOutbox`:

```typescript
export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncMutation<T = unknown> {
  readonly id: string;               // Unique mutation ID (UUID)
  readonly clientMutationId: string; // Idempotency key
  readonly entityType: 'goal' | 'roadmap' | 'task' | 'session' | 'weeklyPlan' | 'weeklyPlanItem' | 'teacherGrant';
  readonly entityId: string;
  readonly operation: SyncOperation;
  readonly payload: T | null;        // Full entity payload for create/update; null for delete
  readonly timestamp: string;        // ISO 8601 UTC timestamp of local action
  readonly deviceId: string;         // Originating device ID
}
```

### 5.3 Soft Deletions & Tombstones
Physical hard deletion in local storage during offline mode would cause deleted items to be resurrected when downloading deltas from the server.
* **Tombstone**: When an entity is deleted, a tombstone record is recorded with `deletedAt: Timestamp`.
* The server and other clients apply the tombstone to their local stores.
* Tombstones have a configurable retention period (e.g., 30 days) before purging.

### 5.4 Delta Synchronization Protocol (Push / Pull)
1. **Push Phase**:
   - Client queries `SyncOutbox` for items with status `pending`.
   - Sends batch of mutations to `POST /api/sync/push`.
   - On `200 OK`, marks sent mutations as `synced` and removes them from the outbox.
2. **Pull Phase**:
   - Client requests deltas with `GET /api/sync/pull?since={serverCursor}`.
   - Server returns all changesets and tombstones updated after `serverCursor`, plus a new `nextCursor`.
   - Client passes incoming changesets through the **Conflict Resolver**.
   - Resolved changes are saved to local repositories, and local `serverCursor` is updated.

---

## 6. Conflict Resolution Strategy

Conflicts arise when the same entity is modified on multiple devices while offline. PathFlow employs a deterministic, rule-based conflict resolution architecture:

### 6.1 Entity-Specific Rules

1. **Session Records (Work Execution Logs)**:
   - **Rule**: **Append-Mostly & Immutable**.
   - Work sessions represent factual past events (`startedAt`, `endedAt`, `durationMinutes`).
   - If two devices record sessions concurrently (even for the same task), both sessions are valid historical records and are merged additively.
   - If a session is deleted on one device and untouched on another, the deletion (tombstone) wins.

2. **Weekly Plans & Weekly Plan Items**:
   - **Problem in naive systems**: Saving an entire week clobbers individual day changes made on another device.
   - **PathFlow Solution**: Weekly plans are normalized into `WeeklyPlan` (header metadata: capacity target) and `WeeklyPlanItem` (individual task commitments).
   - If Device A adds a plan item for Tuesday and Device B adds a plan item for Thursday, **both items are preserved** because they are distinct `WeeklyPlanItem` entities.
   - If both devices edit the exact same plan item, the edit with the later `timestamp` wins (LWW).

3. **Tasks**:
   - If Device A completes a task offline (`status: 'completed'`) and Device B updates the task description (`updatedAt` later), PathFlow applies a **field-aware merge**:
     - Status transition to `completed` preserves completion timestamp.
     - Text edits are merged or the later timestamp wins.

4. **Tombstones vs Updates**:
   - If an entity is deleted (`deletedAt`) and an incoming update has a timestamp *before* `deletedAt`, the tombstone wins (item remains deleted).
   - If an incoming update has a timestamp *after* `deletedAt` (e.g., explicit resurrection), the newer update wins.

---

## 7. Teacher Access & Authorization Architecture

### 7.1 The Mentorship Principle
Teacher View is designed for transparent progress inspection, not micromanagement or grading. The system guarantees that:
* **The student is in full control** of who observes their work.
* **The teacher cannot mutate** student goals, roadmaps, tasks, sessions, plans, or preferences.
* Access can be revoked instantly by the student.

### 7.2 Grant Model
Students generate a cryptographically signed or secure token-based `TeacherAccessGrant`:

```typescript
export type TeacherPermission =
  | 'read:goals'
  | 'read:roadmaps'
  | 'read:tasks'
  | 'read:sessions'
  | 'read:weekly_plans'
  | 'read:reports';

export interface TeacherAccessGrant {
  readonly id: string;
  readonly studentId: string;
  readonly label: string;             // e.g. "Dr. Arash (Thesis Advisor)"
  readonly token: string;             // High-entropy bearer access token
  readonly role: 'read_only';         // Strict immutable role
  readonly permissions: readonly TeacherPermission[];
  readonly createdAt: string;
  readonly expiresAt?: string;        // Optional TTL
  readonly revokedAt?: string;        // Set upon revocation
  readonly isActive: boolean;
}
```

### 7.3 Multi-Layer Read-Only Enforcement
1. **Transport Layer**: The remote server rejects any non-`GET` request authenticated with a Teacher Grant token with `403 Forbidden`.
2. **Adapter Layer**: The client `TeacherRemoteAdapter` exposes only read queries (`listGoals`, `listRoadmaps`, `listTasks`, `querySessionHistory`, `getWeeklyPlan`, `getPeriodProgressReview`). Any call to write methods throws an immediate `TeacherPermissionError`.
3. **UI Layer**: The `TeacherView` contains zero form inputs, edit buttons, or timer triggers.

---

## 8. Summary of Components Implemented in Phase 14A

1. **`src/sync/types.ts`**: Complete contract types for mutations, outbox items, sync payloads, status events, and teacher grants.
2. **`src/sync/outbox/syncOutbox.ts`**: Durable outbox queue with FIFO ordering, status lifecycles (`pending` → `in_flight` → `synced`), and retry handling.
3. **`src/sync/conflict/conflictResolver.ts`**: Pure, deterministic conflict resolution engine implementing LWW, tombstone precedence, and session immutability.
4. **`src/sync/engine/syncEngine.ts`**: Sync engine coordinating push/pull cycles, outbox drainage, cursor progression, and status event broadcasting.
5. **`src/sync/teacher/teacherAccessManager.ts`**: Student-side grant generator, token validator, and revocation manager.
6. **`src/data/remote/teacherRemoteAdapter.ts`**: Read-only remote query gateway enforcing strict mutation rejection.
7. **Comprehensive Unit Test Suite**: Verification of outbox queuing, conflict scenarios, sync cycles, and teacher security invariants.
