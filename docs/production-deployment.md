# PathFlow Production Deployment & Verification Guide

This document defines the production architecture, configuration, containerization, migration workflows, security parameters, and multi-device verification status for PathFlow.

---

## 1. System Architecture Overview

PathFlow follows an **offline-first, cloud-replicated** architecture:

```
+-------------------------------------------------------------+
|                      Client Browser                         |
|  +-------------------------------------------------------+  |
|  |             PathFlow React SPA (Vite)                 |  |
|  |                                                       |  |
|  |  +---------------------+     +---------------------+  |  |
|  |  |  IndexedDB (Dexie)  |<--->|    Durable Outbox   |  |  |
|  |  +---------------------+     +----------+----------+  |  |
|  +-----------------------------------------|-------------+  |
+--------------------------------------------|----------------+
                                             | HTTPS / TLS
                                             v
+-------------------------------------------------------------+
|                 Reverse Proxy (TLS Termination)             |
|                 (Nginx / Caddy / Cloudflare / ALB)          |
+-------------------------------------------------------------+
                                             | Internal HTTP
                                             v
+-------------------------------------------------------------+
|                  Backend Service (Fastify)                  |
|  - Token Authentication (Student & Read-Only Teacher)       |
|  - Sync Delta Protocol (Idempotent Push & Cursor Pull)      |
|  - Entity Access Control & Scoped Teacher Permissions       |
|  - MemoryStore Fallback (Local/Test) | PrismaStore (Prod)   |
+-------------------------------------------------------------+
                                             |
                                             v
+-------------------------------------------------------------+
|                  PostgreSQL 16 Database                     |
|  - Relational Schema with Foreign Keys & Cascading Deletes  |
|  - Idempotency Records & Monotonic Sequence Generation      |
|  - Tombstone Tracking for Resilient Offline Deletions       |
+-------------------------------------------------------------+
```

### Invariant Preservation
* **Offline-First**: The frontend requires zero network access for all user workflows (creating goals, roadmaps, tasks, sessions, plans, and reports). Writes commit instantly to local IndexedDB and record into the durable outbox.
* **Non-Destructive Sync**: Remote network or server outages never lose local data. Retries happen automatically upon reconnection or manual trigger.
* **Separation of Concerns**: Teacher tokens grant strictly read-only access to scoped entities and can never be used to modify student data or sign in as students.

---

## 2. Environment Variables & Production Secrets

### Backend Configuration

| Variable | Environment | Description | Example / Default |
|---|---|---|---|
| `NODE_ENV` | All | Application runtime mode (`production`, `development`, `test`). | `production` |
| `PORT` | All | Network port for Fastify server. | `3001` |
| `HOST` | All | Host binding address. | `0.0.0.0` |
| `DATABASE_URL` | Production (Mandatory) | PostgreSQL connection string with credentials and pool parameters. | `postgresql://pathflow:secret@postgres:5432/pathflow_db?schema=public` |
| `AUTH_SECRET` | Production (Mandatory) | Cryptographic signing secret for JWT authentication tokens. Must be >= 32 characters. Default/development placeholders are rejected at boot in production. | `b49f92...60f3` (32+ random hex/base64 chars) |
| `CORS_ALLOWED_ORIGINS` | Production (Mandatory) | Explicit permitted frontend origins. Wildcard `*` is strictly forbidden in production. | `https://app.pathflow.example,https://pathflow.example` |

### Frontend Configuration

| Variable | Environment | Description | Example / Default |
|---|---|---|---|
| `VITE_BACKEND_URL` | Optional | Backend API root URL injected at build time. If omitted in production, the client defaults to `window.location.origin` (for reverse-proxy / same-origin setups). In development, defaults to `http://localhost:3001`. | `https://api.pathflow.example` |

---

## 3. Docker Containerization

The repository provides a production-grade multi-stage `Dockerfile` and `docker-compose.yml`.

### Dockerfile Highlights
* **Base Image**: `node:20-alpine` with `openssl` and `libc6-compat` for the Prisma query engine.
* **Deterministic Installation**: Installs locked dependencies from `package.json` and lockfiles.
* **Prisma Generation**: Generates Prisma Client targeting PostgreSQL during build.
* **Health Check**: Native container health check querying Fastify's `/api/health` endpoint every 15 seconds.
* **Process Lifecycle**: Runs `server/src/index.ts` with graceful `SIGTERM` / `SIGINT` shutdown handling.

### Running with Docker Compose

```bash
# 1. Provide production environment variables
export AUTH_SECRET="a-cryptographically-random-secret-key-32-chars-minimum"
export CORS_ALLOWED_ORIGINS="https://app.pathflow.example"

# 2. Build and launch services
docker compose up -d --build

# 3. Check container status
docker compose ps

# 4. View backend logs
docker compose logs -f backend
```

---

## 4. PostgreSQL Database Migration Workflow

PathFlow manages database evolution through standard Prisma migrations (`server/prisma/migrations/`).

### Safe Production Migration Procedure
In CI/CD deployment pipelines or container initialization scripts, execute:

```bash
# Run applied migrations deterministically
npm run db:migrate
# Or directly:
npx prisma migrate deploy --schema=server/prisma/schema.prisma
```

### Critical Rules
1. **NEVER run `prisma migrate reset` in production.** It drops the database schema and destroys all persistent student data and mutation records.
2. **Never edit applied migration files.** Create new additive migrations when extending models.
3. **Database Store Invariant**: If `DATABASE_URL` is unset or `NODE_ENV=test`, the backend defaults safely to `MemoryDatabaseStore`. When `DATABASE_URL` is set in production, `PrismaDatabaseStore` activates automatically and registers an `onClose` hook to cleanly disconnect Prisma upon server termination.

---

## 5. HTTPS & Transport Security

Plain HTTP is strictly forbidden in production for authentication credentials, sync payloads, and teacher tokens.

### Reverse Proxy Architecture
The Fastify server is designed to sit behind a TLS-terminating reverse proxy (e.g., Nginx, Caddy, Cloudflare, AWS ALB).

#### Example Nginx Configuration

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name app.pathflow.example api.pathflow.example;
    return 301 https://$host$request_uri;
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.pathflow.example;

    ssl_certificate /etc/letsencrypt/live/api.pathflow.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.pathflow.example/privkey.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

---

## 6. Frontend Production Sync UX

The user interface explicitly communicates sync and connectivity states in real time via the `SyncStatusBadge` in the header and the Settings Account view:

* **Connected**: Indicates successful synchronization with the remote backend.
* **Offline**: System is disconnected from the network; local IndexedDB operations continue unabated.
* **Server unavailable**: Network is reachable but backend server is offline or restarting.
* **Authentication required**: User is operating in local-only mode; data remains saved locally until sign-in.
* **Privacy & Secret Protection**: Error strings and connection details are sanitized to prevent disclosing internal database paths, credentials, or server topology.

---

## 7. Multi-Device Verification Report

### Automated Real-HTTP Multi-Device Verification
The automated end-to-end integration test suite (`tests/unit/multiDeviceRealHttpSync.test.ts`) verifies complete bi-directional state synchronization between independent devices over real HTTP Fastify wire transport:

1. **Device Isolation**: Device A and Device B each possess independent local IndexedDB storage (`PathFlowDB`), distinct device IDs, and separate durable outboxes.
2. **Push Pipeline**: Device A performs local offline mutations (Goal creation, Roadmap creation, Task completion, Session recording, Weekly planning). Mutations are recorded in Device A's outbox and pushed via HTTP to the Fastify sync endpoint.
3. **Idempotency & Sequence**: The server verifies authentication, enforces student ownership, registers mutation records, assigns monotonic sequence numbers, and rejects duplicate `clientMutationId`s idempotently.
4. **Pull Pipeline**: Device B requests incremental sync deltas using its cursor timestamp. Fastify queries changesets and tombstones. Device B pulls the wire payload, resolves conflicts, and applies changes directly to Device B's local IndexedDB.
5. **Bidirectional Convergence**: Device B mutates items and pushes them back. Device A pulls and resolves state. Both devices converge to identical domain states.
6. **Negative & Edge Cases**: Verified cross-user ownership isolation, teacher grant scoping and revocation, duplicate push handling, retry resilience across simulated network failures, and cursor integrity.

### Physical Multi-Device Status & Reality Check
* **Status**: Automated Wire Multi-Device: **Verified** | Physical Hardware Multi-Device: **Pending External Infrastructure**
* **Reason**: This execution environment is an isolated development container without access to external deployment credentials, DNS hosting, public TLS certificates, or physical mobile/desktop hardware devices.
* **Next Steps for Live Production Release**:
  1. Provision cloud hosting (e.g. Google Cloud Run, AWS ECS/Fargate, Fly.io, Railway, or VPS).
  2. Provision a managed PostgreSQL instance and set `DATABASE_URL`.
  3. Deploy the backend container and run `npm run db:migrate`.
  4. Build and deploy the frontend with `VITE_BACKEND_URL` pointing to the public backend domain.
  5. Conduct live smoke tests from two distinct physical devices (e.g., desktop browser and smartphone) to verify manual multi-device convergence in real-world network conditions.
