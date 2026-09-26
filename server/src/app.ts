/**
 * Fastify Application Factory
 */

import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { DatabaseStore } from './db/types';
import { MemoryDatabaseStore } from './db/memoryStore';
import { PrismaDatabaseStore } from './db/prismaStore';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth/authService';
import { SyncService } from './services/syncService';
import { TeacherService } from './services/teacherService';
import { registerAuthRoutes } from './routes/authRoutes';
import { registerSyncRoutes } from './routes/syncRoutes';
import { registerTeacherRoutes } from './routes/teacherRoutes';
import { loadConfig, ServerConfig } from './config';

export interface BuildAppOptions {
  store?: DatabaseStore;
  config?: ServerConfig;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig();
  const app = fastify({ logger: options.logger ?? false });

  // Register CORS
  app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  // Database Store: use passed store, or Prisma if in production, or MemoryStore fallback
  let store: DatabaseStore;
  if (options.store) {
    store = options.store;
  } else if (process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL) {
    store = new MemoryDatabaseStore();
  } else {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.databaseUrl,
        },
      },
    });
    store = new PrismaDatabaseStore(prisma);
    app.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
  }

  const authService = new AuthService(config.authSecret);
  const syncService = new SyncService(store);
  const teacherService = new TeacherService(store);

  // Health check
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register feature routes
  registerAuthRoutes(app, store, authService);
  registerSyncRoutes(app, syncService, authService);
  registerTeacherRoutes(app, teacherService, authService);

  return app;
}
