/**
 * Server Entrypoint
 */

import { buildApp } from './app';
import { loadConfig } from './config';

async function start() {
  const config = loadConfig();
  const app = buildApp({ config, logger: true });

  try {
    const address = await app.listen({ port: config.port, host: config.host });
    app.log.info(`PathFlow Sync & Teacher Server running at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export * from './app';
export * from './config';
export * from './db';
export * from './auth/authService';
export * from './services/syncService';
export * from './services/teacherService';
