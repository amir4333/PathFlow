import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isValidServerUrl,
  getDefaultServerUrl,
  HttpRemoteSyncClient,
  TeacherHttpClient,
} from '../../src/sync';

test('Phase 5 Validation: URL validator strictly validates production protocols and hosts', () => {
  // Valid URLs
  assert.equal(isValidServerUrl('https://api.pathflow.example.com'), true);
  assert.equal(isValidServerUrl('https://pathflow.example.com/api'), true);
  assert.equal(isValidServerUrl('http://127.0.0.1:8000'), true);
  assert.equal(isValidServerUrl('http://localhost:3001'), true);

  // Invalid URLs
  assert.equal(isValidServerUrl(''), false);
  assert.equal(isValidServerUrl(null), false);
  assert.equal(isValidServerUrl(undefined), false);
  assert.equal(isValidServerUrl('file:///path/to/file'), false);
  assert.equal(isValidServerUrl('javascript:void(0)'), false);
  assert.equal(isValidServerUrl('ftp://example.com'), false);
  assert.equal(isValidServerUrl('not-a-url'), false);
});

test('Phase 5 Validation: Frontend configuration safely resolves production backend URL', () => {
  const url = getDefaultServerUrl();
  assert.ok(typeof url === 'string');
  assert.ok(isValidServerUrl(url));
  // Must start with http:// or https://
  assert.match(url, /^https?:\/\//);
});

test('Phase 5 Validation: PHP schema.sql exists and contains 10 production tables with pf_ prefix', () => {
  const schemaPath = path.resolve(process.cwd(), 'backend/database/schema.sql');
  assert.ok(fs.existsSync(schemaPath), 'schema.sql must exist');

  const content = fs.readFileSync(schemaPath, 'utf8');
  const requiredTables = [
    'User',
    'Goal',
    'Roadmap',
    'Task',
    'Session',
    'WeeklyPlan',
    'WeeklyPlanItem',
    'SyncMutationRecord',
    'Tombstone',
    'TeacherAccessGrant',
  ];

  for (const table of requiredTables) {
    assert.ok(
      content.includes(`CREATE TABLE IF NOT EXISTS \`pf_${table}\``),
      `Table 'pf_${table}' must be defined in schema.sql`
    );
  }

  // Ensure foreign keys point to pf_User, not unprefixed User
  assert.ok(content.includes('REFERENCES `pf_User`'), 'Foreign keys must reference pf_User');
  assert.ok(!content.includes('REFERENCES `User`'), 'No foreign keys should reference unprefixed User');

  // Ensure complete isolation from WordPress tables (5bez_*)
  assert.ok(!content.includes('5bez_'), 'PathFlow schema must not reference any WordPress 5bez_* tables');

  assert.ok(content.includes('ENGINE=InnoDB'), 'Must use InnoDB engine');
  assert.ok(content.includes('utf8mb4'), 'Must use utf8mb4 encoding');
  assert.ok(content.includes('utf8mb4_unicode_ci'), 'Must use utf8mb4_unicode_ci collation');
});

test('Phase 5 Validation: Database init.php and verify.php exist and are executable', () => {
  const initPath = path.resolve(process.cwd(), 'backend/database/init.php');
  const verifyPath = path.resolve(process.cwd(), 'backend/database/verify.php');

  assert.ok(fs.existsSync(initPath), 'backend/database/init.php must exist');
  assert.ok(fs.existsSync(verifyPath), 'backend/database/verify.php must exist');

  const initContent = fs.readFileSync(initPath, 'utf8');
  assert.ok(initContent.includes('Database::getConnection()'));
  assert.ok(initContent.includes('schema.sql'));
});

test('Phase 5 Validation: Apache .htaccess files protect sensitive files and enable routing', () => {
  // 1. backend/public/.htaccess
  const publicHtaccess = path.resolve(process.cwd(), 'backend/public/.htaccess');
  assert.ok(fs.existsSync(publicHtaccess), 'backend/public/.htaccess must exist');
  const publicContent = fs.readFileSync(publicHtaccess, 'utf8');

  assert.ok(publicContent.includes('RewriteEngine On'));
  assert.ok(publicContent.includes('HTTP_AUTHORIZATION'));
  assert.ok(publicContent.includes('HTTP_X_TEACHER_TOKEN'));
  assert.ok(publicContent.includes('Options -Indexes'));

  // 2. backend/.htaccess
  const backendHtaccess = path.resolve(process.cwd(), 'backend/.htaccess');
  assert.ok(fs.existsSync(backendHtaccess), 'backend/.htaccess must exist');
  const backendContent = fs.readFileSync(backendHtaccess, 'utf8');

  assert.ok(backendContent.includes('.env'));
  assert.ok(backendContent.includes('deny') || backendContent.includes('denied'));
});

test('Phase 5 Validation: Gitignore rules protect .env and secrets', () => {
  const rootGitignore = path.resolve(process.cwd(), '.gitignore');
  assert.ok(fs.existsSync(rootGitignore), '.gitignore must exist');
  const rootContent = fs.readFileSync(rootGitignore, 'utf8');
  assert.ok(rootContent.includes('.env'));

  const backendGitignore = path.resolve(process.cwd(), 'backend/.gitignore');
  assert.ok(fs.existsSync(backendGitignore), 'backend/.gitignore must exist');
  const backendContent = fs.readFileSync(backendGitignore, 'utf8');
  assert.ok(backendContent.includes('.env'));
});

test('Phase 5 Validation: HttpRemoteSyncClient formats production headers and payloads accurately', async () => {
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: any = null;
  let capturedUrl = '';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    capturedBody = init?.body ? JSON.parse(String(init.body)) : null;

    if (capturedUrl.includes('/api/sync/push')) {
      return new Response(
        JSON.stringify({
          acceptedMutationIds: ['mut_1'],
          rejectedMutations: [],
          serverTimestamp: '2026-10-01T12:00:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (capturedUrl.includes('/api/sync/pull')) {
      return new Response(
        JSON.stringify({
          changes: [],
          tombstones: [],
          nextCursor: {
            lastSyncTimestamp: '2026-10-01T12:00:00.000Z',
            serverVersion: 100,
          },
          serverTimestamp: '2026-10-01T12:00:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ status: 'ok', online: true, studentId: 'st_123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as any;

  try {
    const mockClient = new HttpRemoteSyncClient({
      baseUrl: 'https://api.pathflow.example.com',
      getAuthToken: () => 'prod_student_jwt_token',
    });

    // 1. Push
    const pushResult = await mockClient.push({
      deviceId: 'prod_device_123',
      mutations: [
        {
          id: 'mut_1',
          deviceId: 'prod_device_123',
          clientMutationId: 'c_mut_1',
          entityType: 'goal',
          entityId: 'goal_1',
          operation: 'create',
          payload: { id: 'goal_1', studentId: 'st_123', title: 'Prod Goal', description: '', status: 'not_started' },
          timestamp: '2026-10-01T12:00:00.000Z',
        },
      ],
    });

    assert.equal(capturedUrl, 'https://api.pathflow.example.com/api/sync/push');
    assert.equal(capturedHeaders['Authorization'], 'Bearer prod_student_jwt_token');
    assert.equal(capturedBody.deviceId, 'prod_device_123');
    assert.equal(capturedBody.mutations.length, 1);
    assert.deepEqual(pushResult.acceptedMutationIds, ['mut_1']);

    // 2. Pull
    const pullResult = await mockClient.pull({
      cursor: { lastSyncTimestamp: '2026-10-01T12:00:00.000Z', serverVersion: 50 },
    });
    assert.equal(capturedUrl, 'https://api.pathflow.example.com/api/sync/pull');
    assert.equal(capturedHeaders['Authorization'], 'Bearer prod_student_jwt_token');
    assert.deepEqual(capturedBody.cursor, { lastSyncTimestamp: '2026-10-01T12:00:00.000Z', serverVersion: 50 });
    assert.equal(pullResult.nextCursor?.serverVersion, 100);

    // 3. Status
    const statusResult = await mockClient.getStatus!();
    assert.equal(capturedUrl, 'https://api.pathflow.example.com/api/sync/status');
    assert.equal(statusResult.status, 'ok');
    assert.equal(statusResult.studentId, 'st_123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Phase 5 Validation: TeacherHttpClient strictly transmits read-only headers and accesses endpoints', async () => {
  let capturedHeaders: Record<string, string> = {};
  let capturedUrl = '';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    return new Response(JSON.stringify([{ id: 'goal_1', title: 'Learning Goal' }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as any;

  try {
    const teacherClient = new TeacherHttpClient('https://api.pathflow.example.com');
    const goals = await teacherClient.getStudentGoals('st_test_student', 'pt_prod_token_abc');
    assert.equal(capturedUrl, 'https://api.pathflow.example.com/api/teacher/students/st_test_student/goals');
    assert.equal(capturedHeaders['X-Teacher-Token'], 'pt_prod_token_abc');
    assert.equal(goals.length, 1);
    assert.equal(goals[0].id, 'goal_1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
