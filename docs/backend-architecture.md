# PathFlow Backend Architecture Specification

## 1. Overview & Vision

The PathFlow backend serves as a **cloud replication and synchronization hub** that links students across multiple devices and empowers authorized educators/advisors with read-only progress views.

### Foundational Principle:
**The backend is an auxiliary replication layer, NEVER a replacement for the local-first architecture.**
PathFlow functions 100% offline. IndexedDB remains the primary, immediate working data store on every client.

```text
┌─────────────────────────────────────────────────────────────┐
│                      STUDENT CLIENT                         │
│  React UI → Application Services → Local IndexedDB + Outbox │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON Delta Sync
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 FASTIFY BACKEND (Node.js)                   │
│                                                             │
│   • Authentication & Session Management (HMAC-SHA256)       │
│   • Delta Sync Engine (Push/Pull with Cursors)              │
│   • Mutation Idempotency Layer (student/device/mutationId)  │
│   • Student Ownership Enforcement                           │
│   • Teacher Read-Only Access Gateway                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Prisma ORM
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 POSTGRESQL DATABASE                         │
│                                                             │
│   • Users (Students & Teachers)                             │
│   • Synchronized Entities (Goals, Roadmaps, Tasks, etc.)    │
│   • Mutation Log & Server Sequence Tracking                 │
│   • Tombstones for Reliable Deletion Propagation            │
│   • Teacher Access Grants & Verification Tokens             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Layout & Layering

The backend code is strictly decoupled from the frontend presentation code:

```text
server/
├── prisma/
│   └── schema.prisma         # PostgreSQL schema definition
├── src/
│   ├── config/               # Environment variables and options
│   │   └── index.ts
│   ├── db/                   # Database interfaces & implementations
│   │   ├── types.ts          # Storage contract definitions
│   │   ├── memoryStore.ts    # Fast in-memory store for unit/integration tests
│   │   └── prismaStore.ts    # Production PostgreSQL Prisma store
│   ├── auth/                 # Password hashing & token verification
│   │   ├── types.ts
│   │   └── authService.ts
│   ├── services/             # Core business logic
│   │   ├── syncService.ts    # Idempotent push/pull mutation processor
│   │   └── teacherService.ts # Grant validation & read-only querying
│   ├── routes/               # Fastify route controllers
│   │   ├── authRoutes.ts     # Register, login, me
│   │   ├── syncRoutes.ts     # Push, pull, status
│   │   └── teacherRoutes.ts  # Grants management & student data read endpoints
│   ├── app.ts                # Fastify application factory
│   └── index.ts              # Production server entrypoint
└── docker-compose.yml        # PostgreSQL development container
```

---

## 3. Database Schema

The database model is expressed via Prisma ORM:

1. **`User`**:
   - `id`: UUID primary key
   - `email`: unique identifier
   - `passwordHash`: bcrypt hash (cost 10)
   - `role`: `'student'` or `'teacher'`
   - `createdAt`, `updatedAt`

2. **Student Data Entities**:
   - `Goal`, `Roadmap`, `Task`, `Session`, `WeeklyPlan`, `WeeklyPlanItem`
   - Every record is indexed and foreign-keyed to `studentId` with cascading delete.

3. **`SyncMutationRecord`**:
   - `id`: UUID primary key
   - `studentId`: owning student
   - `deviceId`: client device identifier
   - `clientMutationId`: client-generated idempotency key
   - `sequence`: auto-incrementing integer server sequence
   - `entityType`, `entityId`, `operation` (`create` | `update` | `delete`)
   - `payload`: serialized JSON entity snapshot
   - `timestamp`: client UTC timestamp
   - **Unique constraint**: `@@unique([studentId, deviceId, clientMutationId])` guarantees that repeated uploads are idempotent.

4. **`Tombstone`**:
   - `studentId`, `entityType`, `entityId`, `deletedAt`, `sequence`
   - Unique per `(studentId, entityType, entityId)` to prevent resurrected records.

5. **`TeacherAccessGrant`**:
   - `id`: grant identifier
   - `studentId`: student issuing the grant
   - `label`: mentor/advisor name or description
   - `token`: high-entropy bearer token (`pt_...`)
   - `role`: strictly `'read_only'`
   - `permissions`: JSON array of string permissions
   - `createdAt`, `expiresAt`, `revokedAt`, `isActive`

---

## 4. Idempotency & Deduplication

Network drops and automatic retries can cause the client to submit the same batch of mutations multiple times.
The server handles this gracefully:
- When a mutation arrives, the server checks `(studentId, deviceId, clientMutationId)`.
- If already present, the mutation is acknowledged immediately without re-executing storage side-effects.
- Client receives confirmation and marks local outbox entries as synced.

---

## 5. Security & Isolation Invariants

1. **Zero Cross-Student Visibility**: Every database query on synchronized data strictly filters on `studentId = request.user.userId`.
2. **Read-Only Teacher Enforcement**: The teacher routes expose solely HTTP `GET` methods. Any `POST`, `PUT`, `PATCH`, or `DELETE` attempt on teacher student paths is rejected with `403 Forbidden`.
3. **No Plaintext Passwords**: Passwords are systematically hashed using `bcrypt` before storage.
