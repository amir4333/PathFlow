import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, ConfigurationError } from '../../server/src/config';
import { buildApp } from '../../server/src/app';
import { MemoryDatabaseStore } from '../../server/src/db/memoryStore';
import { getDefaultServerUrl } from '../../src/sync/config/serverConfig';

test('Production Config: Enforces mandatory DATABASE_URL in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    process.env.AUTH_SECRET = 'a-very-strong-production-secret-key-32chars!!';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.pathflow.example';

    assert.throws(
      () => loadConfig(),
      (err: any) => {
        assert.ok(err instanceof ConfigurationError);
        assert.match(err.message, /DATABASE_URL environment variable is required in production/i);
        return true;
      }
    );
  } finally {
    process.env = originalEnv;
  }
});

test('Production Config: Rejects default or weak AUTH_SECRET in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.pathflow.example';

    // 1. Weak secret (<32 chars)
    process.env.AUTH_SECRET = 'short-secret';
    assert.throws(
      () => loadConfig(),
      (err: any) => {
        assert.ok(err instanceof ConfigurationError);
        assert.match(err.message, /AUTH_SECRET must be at least 32 characters/i);
        return true;
      }
    );

    // 2. Default placeholder secret
    process.env.AUTH_SECRET = 'change-this-placeholder-secret-that-is-long-enough-32c';
    assert.throws(
      () => loadConfig(),
      (err: any) => {
        assert.ok(err instanceof ConfigurationError);
        assert.match(err.message, /cannot use default\/development placeholder values/i);
        return true;
      }
    );
  } finally {
    process.env = originalEnv;
  }
});

test('Production Config: Rejects wildcard CORS and requires CORS_ALLOWED_ORIGINS in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.AUTH_SECRET = 'a-very-strong-production-secret-key-32chars!!';

    // 1. Missing CORS_ALLOWED_ORIGINS
    delete process.env.CORS_ALLOWED_ORIGINS;
    assert.throws(
      () => loadConfig(),
      (err: any) => {
        assert.ok(err instanceof ConfigurationError);
        assert.match(err.message, /CORS_ALLOWED_ORIGINS environment variable is required in production/i);
        return true;
      }
    );

    // 2. Wildcard origin
    process.env.CORS_ALLOWED_ORIGINS = '*';
    assert.throws(
      () => loadConfig(),
      (err: any) => {
        assert.ok(err instanceof ConfigurationError);
        assert.match(err.message, /Wildcard CORS \("\*"\) is strictly prohibited in production/i);
        return true;
      }
    );

    // 3. Comma-separated list containing wildcard
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.pathflow.example, *';
    assert.throws(
      () => loadConfig(),
      (err: any) => {
        assert.ok(err instanceof ConfigurationError);
        assert.match(err.message, /Wildcard CORS \("\*"\) is strictly prohibited in production/i);
        return true;
      }
    );
  } finally {
    process.env = originalEnv;
  }
});

test('Production Config: Parses explicit single and multiple origins correctly in production', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.AUTH_SECRET = 'a-very-strong-production-secret-key-32chars!!';

    // 1. Single explicit origin
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.pathflow.example';
    const configSingle = loadConfig();
    assert.equal(configSingle.corsOrigin, 'https://app.pathflow.example');

    // 2. Multiple comma-separated origins
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.pathflow.example, https://admin.pathflow.example';
    const configMulti = loadConfig();
    assert.deepEqual(configMulti.corsOrigin, [
      'https://app.pathflow.example',
      'https://admin.pathflow.example',
    ]);
  } finally {
    process.env = originalEnv;
  }
});

test('Production Readiness: Health endpoint and graceful server lifecycle', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({
    store,
    config: {
      databaseUrl: 'memory://test',
      authSecret: 'test-secret-key-for-lifecycle-testing-32chars',
      port: 0,
      host: '127.0.0.1',
      corsOrigin: false,
      nodeEnv: 'test',
    },
    logger: false,
  });

  // Health check response verification
  const response = await app.inject({
    method: 'GET',
    url: '/api/health',
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.status, 'ok');
  assert.ok(body.timestamp);

  // Graceful shutdown closes without errors
  await app.close();
});

test('Frontend Server Config: Returns sensible default URL', () => {
  const defaultUrl = getDefaultServerUrl();
  assert.ok(typeof defaultUrl === 'string');
  assert.ok(defaultUrl.length > 0);
  assert.doesNotMatch(defaultUrl, /\/$/, 'URL should not have trailing slashes');
});

test('Production CORS Enforcement: Valid frontend origin succeeds while unrelated origin is denied', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({
    store,
    config: {
      databaseUrl: 'memory://test',
      authSecret: 'test-secret-key-for-lifecycle-testing-32chars',
      port: 0,
      host: '127.0.0.1',
      corsOrigin: 'https://app.pathflow.example',
      nodeEnv: 'production',
    },
    logger: false,
  });

  // 1. Valid origin preflight / request
  const validRes = await app.inject({
    method: 'OPTIONS',
    url: '/api/health',
    headers: {
      origin: 'https://app.pathflow.example',
      'access-control-request-method': 'GET',
    },
  });
  assert.equal(validRes.headers['access-control-allow-origin'], 'https://app.pathflow.example');

  // 2. Unrelated / unauthorized origin preflight / request
  const invalidRes = await app.inject({
    method: 'OPTIONS',
    url: '/api/health',
    headers: {
      origin: 'https://evil.attacker.example',
      'access-control-request-method': 'GET',
    },
  });
  assert.notEqual(invalidRes.headers['access-control-allow-origin'], 'https://evil.attacker.example');

  await app.close();
});
