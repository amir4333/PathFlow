# Multi-stage production Dockerfile for PathFlow Backend Service
FROM node:20-alpine AS base

# Install OpenSSL and libc compatibility for Prisma engine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Dependencies stage
FROM base AS dependencies
COPY package.json bun.lock* ./
RUN npm install

# Runner stage
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

WORKDIR /app

# Copy installed dependencies and project files required for backend
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY server ./server
COPY src ./src

# Generate Prisma Client for PostgreSQL
RUN npx prisma generate --schema=server/prisma/schema.prisma

# Expose backend HTTP port
EXPOSE 3001

# Container healthcheck targeting the Fastify health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/health || exit 1

# Start Fastify backend server
CMD ["npx", "tsx", "server/src/index.ts"]
