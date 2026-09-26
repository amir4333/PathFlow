# PathFlow Backend Setup & Local Development Guide

## 1. Prerequisites

- Node.js 20+
- npm or bun
- Docker & Docker Compose (for running local PostgreSQL)

---

## 2. Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env
```

Key environment variables:
- `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql://pathflow:pathflow_secret@localhost:5432/pathflow_db?schema=public`)
- `AUTH_SECRET`: Secret key used for signing JWT/HMAC tokens (must be at least 32 characters in production)
- `PORT`: Port the Fastify server listens on (default: `3001`)
- `HOST`: Host interface (default: `0.0.0.0`)

---

## 3. Starting the Local Database

A lightweight PostgreSQL container is defined in `docker-compose.yml`:

```bash
# Start PostgreSQL container
docker compose up -d

# Verify database is healthy
docker compose ps
```

---

## 4. Database Migrations

Generate the Prisma Client and apply migrations:

```bash
# Generate Prisma Client
npm run db:generate

# Apply migrations
npx prisma migrate dev --schema=server/prisma/schema.prisma
```

---

## 5. Starting the Services

### Start Backend API Server:
```bash
npm run server
# Server starts on http://localhost:3001
```

### Start Frontend Dev Server:
```bash
npm run dev
# Frontend starts on http://localhost:3000
```

---

## 6. Testing the Synchronization Workflow

1. **Register a Student Account**:
   ```bash
   curl -X POST http://localhost:3001/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"alice@example.com","password":"mypassword123","role":"student"}'
   ```
   Save the returned `token`.

2. **Push a Local Mutation**:
   ```bash
   curl -X POST http://localhost:3001/api/sync/push \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TOKEN>" \
     -d '{
       "deviceId": "laptop-1",
       "mutations": [{
         "id": "mut-1",
         "clientMutationId": "c-1",
         "entityType": "goal",
         "entityId": "g-1",
         "operation": "create",
         "payload": {"title": "Learn Distributed Systems"},
         "timestamp": "2026-09-25T12:00:00.000Z"
       }]
     }'
   ```

3. **Pull Changes from Another Device**:
   ```bash
   curl -X POST http://localhost:3001/api/sync/pull \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TOKEN>" \
     -d '{"cursor": null}'
   ```

4. **Run Automated Test Suite**:
   ```bash
   npm test
   ```
