# PathFlow Phase 15 — Real Sync & Account UX Specification

## 1. Overview & Philosophy

PathFlow maintains a strict **local-first, offline-first** architecture. The remote server is treated as a synchronization, backup, and observation replica—**not** an authoritative database that gates local productivity.

Users can plan, focus, log sessions, organize roadmaps, and review progress completely offline without an internet connection or account. When a student chooses to sign in, the synchronization layer runs transparently in the background.

---

## 2. Student Authentication & Session Lifecycle

### 2.1 Credential & Token Handling
* **Registration & Login**: Students authenticate against `/api/auth/register` and `/api/auth/login`.
* **Zero Secret Exposure**: Passwords are never stored in client state, never persisted to browser storage, and never logged in console outputs.
* **Session Persistence**: An authenticated session object (`AuthSession`) containing `{ user: { id, email, role }, token, serverUrl }` is persisted to `localStorage` under `pathflow_auth_session`.
* **Session Verification**: On application boot, `GET /api/auth/me` verifies that the bearer token is still valid.
  * If the server returns `401 Unauthorized`: the expired session is safely cleared and the user is prompted to sign in again.
  * If the network is unreachable (server unavailable or device offline): **local session is preserved**, allowing uninterrupted offline workflow.
* **Sign Out**: `signOut()` immediately clears the stored token, stops background sync intervals, and resets sync cursors. Local IndexedDB entities remain untouched.

---

## 3. Server Connection States

The application header and settings view clearly reflect the following six connection states:

| Connection State | Definition | Header Indicator | User Experience |
| :--- | :--- | :--- | :--- |
| **`connected`** | Authenticated, online, and sync is idle. | Green Check / Synced | Data is fully in sync across devices. |
| **`connecting`** | Actively pushing pending mutations or pulling remote deltas. | Blue Spinner / Syncing... | Background sync in progress. |
| **`offline`** | Browser or system reports no network (`!navigator.onLine`). | Neutral Wifi / Offline | Local IndexedDB continues without network. |
| **`auth_required`** | User is not logged in or token has expired. | Amber Lock / Local Mode | Working locally; click to sign in and sync. |
| **`server_unavailable`** | Backend cannot be reached (e.g. ECONNREFUSED, 503, timeout). | Rose Alert / Server Offline | Offline workflow continues; retries automatically. |
| **`error`** | Sync error occurred during push or pull processing. | Rose Alert / Sync Error | Mutation preserved in outbox for automatic retry. |

---

## 4. Durable Outbox & Offline Workflow

### 4.1 Mutation Interception
All write operations (`create`, `update`, `delete`) performed via Application Services (`GoalService`, `TaskService`, `SessionService`, `WeeklyPlanningService`) pass through `createSyncRecordingRepositories`. This ensures:
1. Immediate commit to local Dexie IndexedDB (`PathFlowDB`).
2. Immediate append of a `SyncMutation` record into the durable `SyncOutbox`.
3. Notification to the `SyncEngine` to trigger background push if online.

### 4.2 Safe Outbox Inspection
The Outbox Modal (`src/features/sync/OutboxModal.tsx`) allows users to inspect pending, in-flight, failed, and synced changes:
* **Read-Only Invariant**: Users cannot manually edit mutation payloads or client identifiers, preventing database corruption.
* **Retry Policy**: Failed mutations increment their `retryCount` and record `lastError`. Mutations with fewer than 5 retries remain eligible for automatic background retry.
* **Local Preservation Guarantee**: Clear UI messaging confirms that local IndexedDB data is never clobbered or destroyed when synchronization fails.

---

## 5. Automatic Synchronization Lifecycle

* **Lifecycle Wiring**: `SyncEngine` is initialized within `SyncProvider` and automatically mounts event listeners for browser `online` and `offline` events.
* **Reconnection Sync**: When network connectivity returns, `SyncEngine` detects the transition and immediately initiates a synchronization cycle.
* **Non-Aggressive Periodic Sync**: When authenticated and online, a background cycle runs every 60 seconds.
* **Concurrent Sync Prevention**: If `syncOnce()` is triggered while an existing sync iteration is in flight, the subsequent call exits immediately without launching parallel push/pull requests.
* **Idempotency Guarantee**: The backend validates `(studentId, deviceId, clientMutationId)` and acknowledges already-processed mutations without duplicate side effects.

---

## 6. Multi-Device Flow & Conflict Resolution

```text
Device A (Workstation)                      Backend (PostgreSQL)                      Device B (Laptop)
       │                                             │                                       │
Local Mutation                                       │                                       │
       ▼                                             │                                       │
IndexedDB Commit                                     │                                       │
       ▼                                             │                                       │
Outbox Enqueue                                       │                                       │
       ▼                                             │                                       │
HttpRemoteSyncClient.push() ────────────────────────►│                                       │
                                              Store Mutation & Audit                         │
                                                     │◄─────────────────────── HttpRemoteSyncClient.pull()
                                                     │                                       ▼
                                              Return Deltas                           ConflictResolver
                                                                                             ▼
                                                                                      IndexedDB Update
```

1. **Deterministic Ordering**: Mutations include client timestamps (`Timestamp` in UTC ISO 8601).
2. **Conflict Resolution**: `ConflictResolver` applies Last-Write-Wins (LWW) with special rules:
   * Sessions are append-only immutable execution records.
   * Tasks merge completion status and content independently.
   * WeeklyPlanItems resolve at the item level to prevent overwriting whole weekly boards.
   * Deleted entities generate tombstones that supersede older modifications.

---

## 7. Teacher Access Compatibility

* **Student-Controlled Grants**: Students can generate, inspect, and revoke read-only teacher tokens in Settings.
* **Granular Scopes**: Permissions include `read:goals`, `read:roadmaps`, `read:tasks`, `read:sessions`, `read:weekly_plans`, and `read:reports`.
* **Strict Read-Only Guarantee**: Teachers can observe student timelines, milestones, and sessions, but are strictly prohibited from mutating student data at all layers (client, HTTP server, database).

---

## 8. What Data Remains Local

To preserve user privacy and offline independence:
* **User Preferences**: Language selection (`en` / `fa`) and calendar system selection (`gregorian` / `persian`) remain stored strictly in `localStorage` on each client device.
* **Active Focus Timers**: Live in-flight session timers (`ActiveSession`) remain local until stopped and committed as a completed session log.
