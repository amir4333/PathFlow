/**
 * Server Configuration
 *
 * Loads, normalizes, and validates environment variables.
 * Enforces production-grade secret strength and CORS constraints.
 */

export interface ServerConfig {
  readonly databaseUrl: string;
  readonly authSecret: string;
  readonly port: number;
  readonly host: string;
  readonly corsOrigin: boolean | string | string[];
  readonly nodeEnv: string;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function loadConfig(): ServerConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://pathflow:pathflow_secret@localhost:5432/pathflow_db?schema=public';

  const authSecret =
    process.env.AUTH_SECRET ||
    (isProduction ? '' : 'pathflow-development-secret-key-32chars-minimum!!');

  // Enforce production security requirements
  if (isProduction) {
    if (!process.env.DATABASE_URL) {
      throw new ConfigurationError(
        'DATABASE_URL environment variable is required in production environment.'
      );
    }
    if (
      !authSecret ||
      authSecret.length < 32 ||
      authSecret.includes('development') ||
      authSecret.includes('change-this')
    ) {
      throw new ConfigurationError(
        'AUTH_SECRET must be at least 32 characters and cannot use default/development placeholder values in production.'
      );
    }
  }

  const port = parseInt(process.env.PORT || '3001', 10);
  const host = process.env.HOST || '0.0.0.0';

  // Parse and validate CORS origins
  let corsOrigin: boolean | string | string[] = true;
  const rawCorsOrigins = process.env.CORS_ALLOWED_ORIGINS;

  if (isProduction) {
    if (!rawCorsOrigins || rawCorsOrigins.trim().length === 0) {
      throw new ConfigurationError(
        'CORS_ALLOWED_ORIGINS environment variable is required in production (e.g. "https://app.example.com").'
      );
    }

    const trimmed = rawCorsOrigins.trim();
    if (trimmed === '*') {
      throw new ConfigurationError(
        'Wildcard CORS ("*") is strictly prohibited in production. Explicitly configure permitted frontend origin(s) in CORS_ALLOWED_ORIGINS.'
      );
    }

    if (trimmed.includes(',')) {
      const origins = trimmed.split(',').map((o) => o.trim()).filter((o) => o.length > 0);
      if (origins.some((o) => o === '*')) {
        throw new ConfigurationError(
          'Wildcard CORS ("*") is strictly prohibited in production CORS_ALLOWED_ORIGINS.'
        );
      }
      corsOrigin = origins;
    } else {
      corsOrigin = trimmed;
    }
  } else {
    // Development / Test environments
    if (rawCorsOrigins) {
      const trimmed = rawCorsOrigins.trim();
      if (trimmed === '*') {
        corsOrigin = true;
      } else if (trimmed.includes(',')) {
        corsOrigin = trimmed.split(',').map((o) => o.trim()).filter((o) => o.length > 0);
      } else {
        corsOrigin = trimmed;
      }
    } else {
      corsOrigin = true;
    }
  }

  return {
    databaseUrl,
    authSecret,
    port: isNaN(port) ? 3001 : port,
    host,
    corsOrigin,
    nodeEnv,
  };
}
