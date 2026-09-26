/**
 * Server Entrypoint
 */

import { buildApp } from './app';
import { loadConfig } from './config';

async function start() {
  let config;
  try {
    config = loadConfig();
  } catch (err: any) {
    console.error(`[Startup Fatal] Configuration Error: ${err.message}`);
    process.exit(1);
  }

  const app = buildApp({ config, logger: config.nodeEnv !== 'test' });

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, initiating graceful shutdown...`);
    try {
      await app.close();
      app.log.info('PathFlow Sync & Teacher Server closed gracefully.');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during graceful shutdown:');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, 'Unhandled Promise Rejection in server process:');
  });

  process.on('uncaughtException', (err) => {
    app.log.error({ err }, 'Uncaught Exception in server process:');
    process.exit(1);
  });

  try {
    const address = await app.listen({ port: config.port, host: config.host });
    app.log.info(
      `PathFlow Sync & Teacher Server listening at ${address} [env: ${config.nodeEnv}]`
    );
  } catch (err: any) {
    app.log.error(err, `Failed to bind server to ${config.host}:${config.port}`);
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
