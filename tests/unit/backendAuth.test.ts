import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../server/src/app';
import { MemoryDatabaseStore } from '../../server/src/db/memoryStore';
import { AuthService } from '../../server/src/auth/authService';

test('Backend Auth: User registration and token generation', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: 'student@example.com',
      password: 'password123',
      role: 'student',
    },
  });

  assert.equal(res.statusCode, 201);
  const body = JSON.parse(res.payload);
  assert.equal(body.user.email, 'student@example.com');
  assert.equal(body.user.role, 'student');
  assert.ok(body.token);

  // Verify password hash in store is not plain text
  const storedUser = await store.getUserByEmail('student@example.com');
  assert.ok(storedUser);
  assert.notEqual(storedUser.passwordHash, 'password123');
});

test('Backend Auth: Rejects invalid email and short password', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  const res1 = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'notanemail', password: 'password123' },
  });
  assert.equal(res1.statusCode, 400);

  const res2 = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'valid@example.com', password: '123' },
  });
  assert.equal(res2.statusCode, 400);
});

test('Backend Auth: Rejects duplicate email registration', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'duplicate@example.com', password: 'password123' },
  });

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'duplicate@example.com', password: 'newpassword456' },
  });

  assert.equal(res.statusCode, 409);
});

test('Backend Auth: User login with valid vs invalid credentials', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  // Register
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'login@example.com', password: 'correctpassword' },
  });

  // Valid login
  const validRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'login@example.com', password: 'correctpassword' },
  });
  assert.equal(validRes.statusCode, 200);
  const validBody = JSON.parse(validRes.payload);
  assert.ok(validBody.token);

  // Invalid password
  const invalidRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'login@example.com', password: 'wrongpassword' },
  });
  assert.equal(invalidRes.statusCode, 401);

  // Non-existent user
  const notFoundRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'unknown@example.com', password: 'password123' },
  });
  assert.equal(notFoundRes.statusCode, 401);
});

test('Backend Auth: Protected /api/auth/me route requires valid bearer token', async () => {
  const store = new MemoryDatabaseStore();
  const app = buildApp({ store });

  // Without token
  const noTokenRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
  });
  assert.equal(noTokenRes.statusCode, 401);

  // With forged token
  const forgedRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: 'Bearer invalid.forged.token' },
  });
  assert.equal(forgedRes.statusCode, 401);

  // Register and get valid token
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'me@example.com', password: 'password123' },
  });
  const { token, user } = JSON.parse(regRes.payload);

  const validMeRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(validMeRes.statusCode, 200);
  const meBody = JSON.parse(validMeRes.payload);
  assert.equal(meBody.user.id, user.id);
  assert.equal(meBody.user.email, 'me@example.com');
});
