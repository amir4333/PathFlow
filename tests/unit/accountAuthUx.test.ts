import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../server/src/app';
import { MemoryDatabaseStore } from '../../server/src/db/memoryStore';
import {
  registerUser,
  loginUser,
  verifyUserSession,
  loadStoredSession,
  saveStoredSession,
  clearStoredSession,
  AuthError,
  AUTH_SESSION_STORAGE_KEY,
} from '../../src/sync/auth/authSession';
import {
  isValidServerUrl,
  getDefaultServerUrl,
  getStoredServerUrl,
  saveStoredServerUrl,
  SERVER_URL_STORAGE_KEY,
} from '../../src/sync/config/serverConfig';

// Mock localStorage for Node test environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

test('Account & Auth UX: Registration, Login, Session Persistence, and Sign Out', async () => {
  const store = new MemoryDatabaseStore();
  const server = buildApp({ store });
  const address = await server.listen({ port: 0, host: '127.0.0.1' });

  // Mock browser window and localStorage
  const mockStorage = new MockLocalStorage();
  (global as any).window = { localStorage: mockStorage };

  try {
    // 1. Sign Up
    const session1 = await registerUser(
      address,
      'alice.student@example.com',
      'securepass123',
      'student'
    );
    assert.ok(session1.token);
    assert.equal(session1.user.email, 'alice.student@example.com');
    assert.equal(session1.user.role, 'student');
    assert.equal((session1 as any).password, undefined, 'Password must never be in session');

    // Verify persisted in localStorage
    const stored = loadStoredSession();
    assert.ok(stored);
    assert.equal(stored.user.email, 'alice.student@example.com');
    assert.equal(stored.token, session1.token);

    // 2. Sign In
    const session2 = await loginUser(
      address,
      'alice.student@example.com',
      'securepass123'
    );
    assert.ok(session2.token);
    assert.equal(session2.user.email, 'alice.student@example.com');

    // 3. Verify Session (/api/auth/me)
    const verifiedUser = await verifyUserSession(address, session2.token);
    assert.equal(verifiedUser.email, 'alice.student@example.com');
    assert.equal(verifiedUser.role, 'student');

    // 4. Sign Out
    clearStoredSession();
    assert.equal(loadStoredSession(), null);
  } finally {
    delete (global as any).window;
    await server.close();
  }
});

test('Account & Auth UX: Invalid credentials handling (HTTP 401)', async () => {
  const store = new MemoryDatabaseStore();
  const server = buildApp({ store });
  const address = await server.listen({ port: 0, host: '127.0.0.1' });

  try {
    // Register user
    await registerUser(address, 'bob.student@example.com', 'correctpass', 'student');

    // Attempt login with incorrect password
    await assert.rejects(
      async () => {
        await loginUser(address, 'bob.student@example.com', 'wrongpassword');
      },
      (err: any) => {
        assert.ok(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /invalid/i);
        return true;
      }
    );
  } finally {
    await server.close();
  }
});

test('Account & Auth UX: Expired / invalid token handling', async () => {
  const store = new MemoryDatabaseStore();
  const server = buildApp({ store });
  const address = await server.listen({ port: 0, host: '127.0.0.1' });

  try {
    // Attempt verification with an invalid token
    await assert.rejects(
      async () => {
        await verifyUserSession(address, 'invalid_or_expired_jwt_token');
      },
      (err: any) => {
        assert.ok(err instanceof AuthError);
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  } finally {
    await server.close();
  }
});

test('Account & Auth UX: Server unavailable / network error preservation', async () => {
  // Point to a non-existent port where no server is listening
  const nonExistentServer = 'http://127.0.0.1:59999';

  await assert.rejects(
    async () => {
      await loginUser(nonExistentServer, 'test@example.com', 'password123');
    },
    (err: any) => {
      assert.ok(err instanceof AuthError);
      assert.equal(err.isNetworkError, true);
      assert.match(err.message, /Server unavailable/i);
      return true;
    }
  );
});

test('Server Config: URL validation, desktop file:// protection, and safe fallback', () => {
  // Validation checks
  assert.equal(isValidServerUrl('http://localhost:3001'), true);
  assert.equal(isValidServerUrl('https://api.pathflow.example'), true);
  assert.equal(isValidServerUrl('http://192.168.1.100:8080'), true);

  // Invalid schemas / origins
  assert.equal(isValidServerUrl('file://'), false);
  assert.equal(isValidServerUrl('file:///path/to/app'), false);
  assert.equal(isValidServerUrl('null'), false);
  assert.equal(isValidServerUrl(''), false);
  assert.equal(isValidServerUrl(null as any), false);
  assert.equal(isValidServerUrl('ftp://server.example'), false);
  assert.equal(isValidServerUrl('javascript:alert(1)'), false);

  const mockStorage = new MockLocalStorage();
  (global as any).window = {
    localStorage: mockStorage,
    location: { origin: 'file://', protocol: 'file:' },
  };

  // When loaded from file:// (Electron/desktop package), default URL must NOT be file://
  const defaultUrl = getDefaultServerUrl();
  assert.equal(defaultUrl, 'http://localhost:3001');

  // If a legacy or accidental file:// was written to localStorage, getStoredServerUrl must discard it
  mockStorage.setItem(SERVER_URL_STORAGE_KEY, 'file://');
  assert.equal(getStoredServerUrl(), 'http://localhost:3001');
  assert.equal(mockStorage.getItem(SERVER_URL_STORAGE_KEY), null, 'Invalid key must be wiped');

  // Storing valid URLs should persist
  saveStoredServerUrl('https://sync.pathflow.example/');
  assert.equal(getStoredServerUrl(), 'https://sync.pathflow.example');

  // Attempting to save invalid URL should be rejected
  saveStoredServerUrl('file:///tmp/app');
  assert.equal(getStoredServerUrl(), 'https://sync.pathflow.example', 'Invalid URL save ignored or wiped');
});
