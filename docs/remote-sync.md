# PathFlow Remote Synchronization Protocol Specification

## 1. Synchronization Lifecycle

PathFlow utilizes an offline-first **Outbox Pattern** paired with **Delta Synchronization**:

```text
User Action
    │
    ▼
IndexedDB Local Transaction (Instant UI Feedback)
    │
    ▼
Append mutation to Local Outbox
    │
    ▼
[Online Event or Timer Trigger]
    │
    ▼
SyncEngine.syncOnce()
    ├── 1. Push Phase: Reads pending outbox mutations
    │      POST /api/sync/push
    │      Server deduplicates via (studentId, deviceId, clientMutationId)
    │      Server applies to entity store and returns acceptedMutationIds
    │      Client marks outbox records as synced and clears them
    │
    └── 2. Pull Phase: Requests changes after local cursor
           POST /api/sync/pull { cursor }
           Server returns deltas + tombstones + nextCursor
           ConflictResolver applies remote changes into IndexedDB
           Local sync cursor updated
```

---

## 2. API Endpoints

### 2.1 `POST /api/sync/push`
Transmits locally queued mutations to the server.

**Headers**:
- `Authorization: Bearer <STUDENT_JWT>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "deviceId": "laptop-uuid",
  "mutations": [
    {
      "id": "mut-client-uuid",
      "clientMutationId": "mut-idemp-1",
      "entityType": "task",
      "entityId": "task-uuid",
      "operation": "update",
      "payload": {
        "status": "completed",
        "completedAt": "2026-09-25T14:30:00.000Z"
      },
      "timestamp": "2026-09-25T14:30:00.000Z"
    }
  ]
}
```

**Response Body**:
```json
{
  "acceptedMutationIds": ["mut-client-uuid"],
  "rejectedMutations": [],
  "serverTimestamp": "2026-09-25T14:30:01.000Z"
}
```

---

### 2.2 `POST /api/sync/pull`
Retrieves incremental changes from other devices since the specified cursor.

**Headers**:
- `Authorization: Bearer <STUDENT_JWT>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "cursor": {
    "lastSyncTimestamp": "2026-09-25T14:00:00.000Z",
    "serverVersion": 42
  },
  "limit": 100
}
```

**Response Body**:
```json
{
  "changes": [
    {
      "entityType": "goal",
      "entityId": "goal-uuid",
      "payload": {
        "title": "Updated Goal Title"
      },
      "updatedAt": "2026-09-25T14:25:00.000Z"
    }
  ],
  "tombstones": [
    {
      "entityType": "session",
      "entityId": "session-uuid",
      "deletedAt": "2026-09-25T14:28:00.000Z"
    }
  ],
  "nextCursor": {
    "lastSyncTimestamp": "2026-09-25T14:30:01.000Z",
    "serverVersion": 45
  },
  "hasMore": false
}
```

---

## 3. Idempotency Guarantees

Every client mutation carries a unique `clientMutationId`.
The server enforces a compound uniqueness index:
```sql
UNIQUE (student_id, device_id, client_mutation_id)
```
If a client re-sends a batch after a network timeout:
1. The server recognizes that `clientMutationId` has already been recorded.
2. The server acknowledges the mutation ID in `acceptedMutationIds`.
3. Side effects (updates/inserts) are skipped to prevent redundant writes or duplicate records.

---

## 4. Frontend Client Implementation (`HttpRemoteSyncClient`)

The frontend communicates through `HttpRemoteSyncClient`:
- Dispatches standard fetch requests with timeout abort controllers.
- Injects dynamic auth tokens via `getAuthToken()`.
- Captures network failures and propagates typed errors so that `SyncEngine` sets `status: 'offline'` or `'error'` without losing uncommitted mutations in the local outbox.
