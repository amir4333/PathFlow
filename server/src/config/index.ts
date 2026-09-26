/**
 * Server Configuration
 *
 * Loads and validates environment variables.
 */

export interface ServerConfig {
  readonly databaseUrl: string;
  readonly authSecret: string;
  readonly port: number;
  readonly host: string;
  readonly corsOrigin: string | boolean;
}

export function loadConfig(): ServerConfig {
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://pathflow:pathflow_secret@localhost:5432/pathflow_db?schema=public';

  const authSecret =
    process.env.AUTH_SECRET || 'pathflow-development-secret-key-32chars-minimum!!';

  const port = parseInt(process.env.PORT || '3001', 10);
  const host = process.env.HOST || '0.0.0.0';

  return {
    databaseUrl,
    authSecret,
    port: isNaN(port) ? 3001 : port,
    host,
    corsOrigin: true,
  };
}
