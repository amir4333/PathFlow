<?php

declare(strict_types=1);

// Test Runner for PathFlow PHP Backend
// Validates Phase 1 Foundation & Phase 2 Authentication Suite

require_once dirname(__DIR__) . '/src/Support/Autoloader.php';
\PathFlow\Support\Autoloader::register();

use PathFlow\Config\Config;
use PathFlow\Database\Database;
use PathFlow\Http\Request;
use PathFlow\Http\Response;
use PathFlow\Http\Cors;
use PathFlow\Router\Router;
use PathFlow\Support\Uuid;
use PathFlow\Auth\Jwt;
use PathFlow\Auth\UserRepository;
use PathFlow\Auth\AuthService;
use PathFlow\Auth\AuthMiddleware;
use PathFlow\Auth\AuthController;
use PathFlow\Sync\SyncStore;
use PathFlow\Sync\SyncService;
use PathFlow\Sync\SyncController;
use PathFlow\Teacher\TeacherStore;
use PathFlow\Teacher\TeacherService;
use PathFlow\Teacher\TeacherController;

$totalTests = 0;
$passedTests = 0;
$failedTests = 0;

function runTest(string $name, callable $test): void {
    global $totalTests, $passedTests, $failedTests;
    $totalTests++;
    try {
        $test();
        echo "  ✓ PASS: {$name}\n";
        $passedTests++;
    } catch (\Throwable $e) {
        echo "  ✗ FAIL: {$name}\n";
        echo "    " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine() . "\n";
        $failedTests++;
    }
}

function assertEquals(mixed $expected, mixed $actual, string $message = ''): void {
    if ($expected !== $actual) {
        throw new \RuntimeException(sprintf(
            "Assertion failed: expected '%s', got '%s'. %s",
            var_export($expected, true),
            var_export($actual, true),
            $message
        ));
    }
}

function assertTrue(bool $condition, string $message = ''): void {
    if (!$condition) {
        throw new \RuntimeException("Assertion failed: condition is false. {$message}");
    }
}

echo "========================================================\n";
echo " PathFlow PHP Backend Test Suite (Phase 1 & Phase 2)\n";
echo "========================================================\n\n";

// ========================================================
// PHASE 1 TESTS
// ========================================================

runTest('Config: Loads defaults and allows runtime overrides', function () {
    Config::reset();
    assertEquals('default_val', Config::get('NON_EXISTENT_KEY', 'default_val'));

    Config::set('APP_ENV', 'test');
    Config::set('APP_DEBUG', 'true');
    Config::set('DB_PORT', '3306');

    assertEquals('test', Config::get('APP_ENV'));
    assertTrue(Config::getBool('APP_DEBUG'));
    assertEquals(3306, Config::getInt('DB_PORT'));
});

runTest('Request: Parses method, path, query, and headers', function () {
    $req = new Request(
        'GET',
        '/api/test?filter=active&limit=10',
        ['filter' => 'active', 'limit' => '10'],
        ['Authorization' => 'Bearer token_123', 'X-Teacher-Token' => 'pt_teacher_abc']
    );

    assertEquals('GET', $req->getMethod());
    assertEquals('/api/test', $req->getPath());
    assertEquals('active', $req->getQuery('filter'));
    assertEquals('10', $req->getQuery('limit'));
    assertEquals('Bearer token_123', $req->getHeader('authorization'));
    assertEquals('token_123', $req->getBearerToken());
    assertEquals('pt_teacher_abc', $req->getTeacherToken());
});

runTest('Request: Parses structured JSON body payload', function () {
    $payload = ['email' => 'student@test.com', 'role' => 'student'];
    $req = new Request('POST', '/api/auth/register', [], [], $payload);

    assertEquals($payload, $req->getBody());
    assertEquals($payload, $req->getJson());
});

runTest('Response: Formats JSON response and status codes correctly', function () {
    $resp = Response::json(['status' => 'ok'], 200);
    assertEquals(200, $resp->getStatusCode());
    assertEquals(['status' => 'ok'], $resp->getData());
    assertEquals('application/json; charset=utf-8', $resp->getHeaders()['Content-Type']);

    $errResp = Response::error('Invalid input', 400);
    assertEquals(400, $errResp->getStatusCode());
    assertEquals(['error' => 'Invalid input'], $errResp->getData());
});

runTest('CORS: Handles pre-flight OPTIONS request with required headers', function () {
    Config::set('CORS_ORIGIN', 'http://localhost:3000');
    $optReq = new Request('OPTIONS', '/api/sync/push', [], ['Origin' => 'http://localhost:3000']);
    $corsResponse = Cors::handle($optReq);

    assertTrue($corsResponse instanceof Response);
    assertEquals(200, $corsResponse->getStatusCode());
    $headers = $corsResponse->getHeaders();
    assertEquals('http://localhost:3000', $headers['Access-Control-Allow-Origin']);
    assertTrue(str_contains($headers['Access-Control-Allow-Headers'], 'X-Teacher-Token'));
    assertTrue(str_contains($headers['Access-Control-Allow-Headers'], 'Authorization'));
});

runTest('Router: Matches exact routes and returns response', function () {
    $router = new Router();
    $router->get('/api/test', function (Request $req) {
        return Response::ok(['test' => true]);
    });

    $req = new Request('GET', '/api/test');
    $resp = $router->dispatch($req);

    assertEquals(200, $resp->getStatusCode());
    assertEquals(['test' => true], $resp->getData());
});

runTest('Router: Extracts path parameters such as :studentId', function () {
    $router = new Router();
    $router->get('/api/teacher/students/:studentId/goals', function (Request $req) {
        return Response::ok(['studentId' => $req->getParam('studentId')]);
    });

    $req = new Request('GET', '/api/teacher/students/usr_abc123/goals');
    $resp = $router->dispatch($req);

    assertEquals(200, $resp->getStatusCode());
    assertEquals(['studentId' => 'usr_abc123'], $resp->getData());
});

runTest('Router: Supports wildcard mutation rejection on teacher routes', function () {
    $router = new Router();
    $router->any('/api/teacher/students/:studentId/*', function (Request $req) {
        return Response::error('Teacher access is strictly read-only. Mutation operations are prohibited.', 403);
    });

    $req = new Request('POST', '/api/teacher/students/usr_abc123/tasks');
    $resp = $router->dispatch($req);

    assertEquals(403, $resp->getStatusCode());
    assertEquals(
        ['error' => 'Teacher access is strictly read-only. Mutation operations are prohibited.'],
        $resp->getData()
    );
});

runTest('Router: Returns 404 error response on unmapped route', function () {
    $router = new Router();
    $req = new Request('GET', '/api/unknown');
    $resp = $router->dispatch($req);

    assertEquals(404, $resp->getStatusCode());
    assertTrue(isset($resp->getData()['error']));
});

runTest('Health Check: GET /api/health returns status ok with ISO-8601 UTC timestamp', function () {
    $router = new Router();
    $router->get('/api/health', function (Request $req): Response {
        $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
        return Response::ok([
            'status' => 'ok',
            'timestamp' => $now,
        ]);
    });

    $req = new Request('GET', '/api/health');
    $resp = $router->dispatch($req);

    assertEquals(200, $resp->getStatusCode());
    $data = $resp->getData();
    assertEquals('ok', $data['status']);
    assertTrue(isset($data['timestamp']));
    assertTrue((bool)preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $data['timestamp']));
});

runTest('Schema SQL: Contains all 10 required tables with pf_ prefix and InnoDB engine', function () {
    $schemaPath = dirname(__DIR__) . '/database/schema.sql';
    assertTrue(file_exists($schemaPath), 'schema.sql file must exist');

    $sql = file_get_contents($schemaPath);
    $requiredTables = [
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

    foreach ($requiredTables as $table) {
        assertTrue(
            str_contains($sql, "CREATE TABLE IF NOT EXISTS `pf_{$table}`") || str_contains($sql, "CREATE TABLE `pf_{$table}`"),
            "Physical table pf_{$table} must be defined in schema.sql"
        );
    }

    // Verify foreign key references use pf_User
    assertTrue(str_contains($sql, 'REFERENCES `pf_User`'), 'Foreign keys must reference pf_User');
    assertTrue(!str_contains($sql, 'REFERENCES `User`'), 'Foreign keys must not reference unprefixed User');

    // Verify zero WordPress tables referenced
    assertTrue(!str_contains($sql, '5bez_'), 'PathFlow schema must not reference any WordPress 5bez_* table');

    assertTrue(str_contains($sql, 'ENGINE=InnoDB'), 'Must use InnoDB engine');
    assertTrue(str_contains($sql, 'utf8mb4'), 'Must use utf8mb4 charset');
    assertTrue(str_contains($sql, 'SyncMutationRecord_studentId_deviceId_clientMutationId_key'), 'Idempotency key must exist');
    assertTrue(str_contains($sql, 'TeacherAccessGrant_token_key'), 'Teacher token unique key must exist');
});

// ========================================================
// PHASE 2 AUTHENTICATION TESTS
// ========================================================

// Setup in-memory UserRepository for unit testing
$testUserRepo = new UserRepository(true);
$testAuthService = new AuthService($testUserRepo);
$authController = new AuthController($testUserRepo, $testAuthService);

// 1. UUID generation
runTest('UUID: Generates valid RFC 4122 v4 UUIDs', function () {
    $uuid1 = Uuid::v4();
    $uuid2 = Uuid::v4();
    assertTrue($uuid1 !== $uuid2, 'UUIDs must be unique');
    assertTrue(Uuid::isValid($uuid1), 'UUID must match v4 pattern');
    assertTrue(Uuid::isValid($uuid2), 'UUID must match v4 pattern');
});

// 2. JWT tests
runTest('JWT: Generates valid HS256 token and decodes claims', function () {
    Config::set('AUTH_SECRET', 'test_auth_secret_key_1234567890');
    $payload = [
        'userId' => 'usr-12345',
        'email' => 'student@test.com',
        'role' => 'student',
    ];

    $token = Jwt::encode($payload);
    $decoded = Jwt::decode($token);

    assertTrue($decoded !== null, 'Token must decode successfully');
    assertEquals('usr-12345', $decoded['userId']);
    assertEquals('student@test.com', $decoded['email']);
    assertEquals('student', $decoded['role']);
    assertTrue(isset($decoded['exp']), 'Exp must be present');
    assertTrue($decoded['exp'] > time(), 'Exp must be in the future');
});

runTest('JWT: Rejects malformed tokens', function () {
    assertEquals(null, Jwt::decode('not.a.valid.jwt.with.too.many.dots'));
    assertEquals(null, Jwt::decode('single_string_no_dots'));
    assertEquals(null, Jwt::decode('two.parts'));
    assertEquals(null, Jwt::decode(''));
});

runTest('JWT: Rejects tokens with modified signatures (tampering)', function () {
    Config::set('AUTH_SECRET', 'test_secret');
    $token = Jwt::encode(['userId' => 'u1', 'email' => 'test@test.com', 'role' => 'student']);
    $parts = explode('.', $token);
    // Tamper with payload
    $tamperedPayload = Jwt::base64UrlEncode(json_encode(['userId' => 'admin_hacked', 'exp' => time() + 3600]));
    $tamperedToken = "{$parts[0]}.{$tamperedPayload}.{$parts[2]}";

    assertEquals(null, Jwt::decode($tamperedToken), 'Tampered token must be rejected');
});

runTest('JWT: Rejects expired tokens', function () {
    Config::set('AUTH_SECRET', 'test_secret');
    $expiredPayload = [
        'userId' => 'u1',
        'email' => 'test@test.com',
        'role' => 'student',
        'exp' => time() - 3600, // 1 hour in the past
    ];
    $token = Jwt::encode($expiredPayload);
    assertEquals(null, Jwt::decode($token), 'Expired token must return null');
});

runTest('JWT: Rejects tokens signed with different secret', function () {
    $token = Jwt::encode(['userId' => 'u1', 'exp' => time() + 3600], 'secret_alpha');
    $decoded = Jwt::decode($token, 'secret_beta');
    assertEquals(null, $decoded, 'Token signed with wrong secret must return null');
});

// 3. Registration tests
runTest('Registration: Valid registration with default student role', function () use ($authController, $testUserRepo) {
    $testUserRepo->clearMemory();
    $req = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'alice@pathflow.app',
        'password' => 'secret123',
    ]);
    $resp = $authController->register($req);

    assertEquals(201, $resp->getStatusCode());
    $data = $resp->getData();
    assertTrue(isset($data['user']));
    assertTrue(isset($data['token']));
    assertEquals('alice@pathflow.app', $data['user']['email']);
    assertEquals('student', $data['user']['role']);
    assertTrue(Uuid::isValid($data['user']['id']));
    // Security check: password & passwordHash must NEVER be exposed
    assertTrue(!isset($data['user']['password']));
    assertTrue(!isset($data['user']['passwordHash']));
});

runTest('Registration: Email normalization (trim + lowercase)', function () use ($authController, $testUserRepo) {
    $testUserRepo->clearMemory();
    $req = new Request('POST', '/api/auth/register', [], [], [
        'email' => "   Bob.Student@Example.COM \n",
        'password' => 'strongpass123',
    ]);
    $resp = $authController->register($req);

    assertEquals(201, $resp->getStatusCode());
    $data = $resp->getData();
    assertEquals('bob.student@example.com', $data['user']['email']);
});

runTest('Registration: Teacher role registration', function () use ($authController, $testUserRepo) {
    $testUserRepo->clearMemory();
    $req = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'prof.smith@university.edu',
        'password' => 'teacherpass123',
        'role' => 'teacher',
    ]);
    $resp = $authController->register($req);

    assertEquals(201, $resp->getStatusCode());
    $data = $resp->getData();
    assertEquals('teacher', $data['user']['role']);
});

runTest('Registration: Rejects invalid email', function () use ($authController) {
    $req = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'invalid-email-without-at',
        'password' => 'secret123',
    ]);
    $resp = $authController->register($req);

    assertEquals(400, $resp->getStatusCode());
    assertEquals(['error' => 'Valid email is required'], $resp->getData());
});

runTest('Registration: Rejects short password (< 6 chars)', function () use ($authController) {
    $req = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'shortpass@example.com',
        'password' => '12345',
    ]);
    $resp = $authController->register($req);

    assertEquals(400, $resp->getStatusCode());
    assertEquals(['error' => 'Password must be at least 6 characters'], $resp->getData());
});

runTest('Registration: Rejects invalid role', function () use ($authController) {
    $req = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'admin@example.com',
        'password' => 'secret123',
        'role' => 'superuser',
    ]);
    $resp = $authController->register($req);

    assertEquals(400, $resp->getStatusCode());
    assertEquals(['error' => 'Role must be student or teacher'], $resp->getData());
});

runTest('Registration: Rejects duplicate email (HTTP 409)', function () use ($authController, $testUserRepo) {
    $testUserRepo->clearMemory();
    $req1 = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'unique@example.com',
        'password' => 'secret123',
    ]);
    $resp1 = $authController->register($req1);
    assertEquals(201, $resp1->getStatusCode());

    // Duplicate attempt with different casing
    $req2 = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'UNIQUE@EXAMPLE.COM',
        'password' => 'differentpass',
    ]);
    $resp2 = $authController->register($req2);

    assertEquals(409, $resp2->getStatusCode());
    assertEquals(['error' => 'Email already registered'], $resp2->getData());
});

// 4. Login tests
runTest('Login: Successful login with valid credentials', function () use ($authController, $testUserRepo) {
    $testUserRepo->clearMemory();
    $regReq = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'loginuser@example.com',
        'password' => 'correctpassword',
        'role' => 'student',
    ]);
    $authController->register($regReq);

    $loginReq = new Request('POST', '/api/auth/login', [], [], [
        'email' => 'loginuser@example.com',
        'password' => 'correctpassword',
    ]);
    $resp = $authController->login($loginReq);

    assertEquals(200, $resp->getStatusCode());
    $data = $resp->getData();
    assertEquals('loginuser@example.com', $data['user']['email']);
    assertTrue(isset($data['token']));
});

runTest('Login: Normalizes email (case insensitivity)', function () use ($authController, $testUserRepo) {
    $testUserRepo->clearMemory();
    $regReq = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'case.test@example.com',
        'password' => 'password123',
    ]);
    $authController->register($regReq);

    $loginReq = new Request('POST', '/api/auth/login', [], [], [
        'email' => '   CASE.TEST@EXAMPLE.COM   ',
        'password' => 'password123',
    ]);
    $resp = $authController->login($loginReq);

    assertEquals(200, $resp->getStatusCode());
});

runTest('Login: Rejects invalid password (HTTP 401)', function () use ($authController, $testUserRepo) {
    $testUserRepo->clearMemory();
    $regReq = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'user@example.com',
        'password' => 'correctpassword',
    ]);
    $authController->register($regReq);

    $loginReq = new Request('POST', '/api/auth/login', [], [], [
        'email' => 'user@example.com',
        'password' => 'wrongpassword',
    ]);
    $resp = $authController->login($loginReq);

    assertEquals(401, $resp->getStatusCode());
    assertEquals(['error' => 'Invalid email or password'], $resp->getData());
});

runTest('Login: Rejects nonexistent email (HTTP 401 generic error)', function () use ($authController) {
    $loginReq = new Request('POST', '/api/auth/login', [], [], [
        'email' => 'nobody@example.com',
        'password' => 'somepassword',
    ]);
    $resp = $authController->login($loginReq);

    assertEquals(401, $resp->getStatusCode());
    assertEquals(['error' => 'Invalid email or password'], $resp->getData());
});

runTest('Login: Rejects missing fields (HTTP 400)', function () use ($authController) {
    $req = new Request('POST', '/api/auth/login', [], [], ['email' => 'missingpass@example.com']);
    $resp = $authController->login($req);

    assertEquals(400, $resp->getStatusCode());
    assertEquals(['error' => 'Email and password are required'], $resp->getData());
});

// 5. GET /api/auth/me tests
runTest('GET /api/auth/me: Resolves authenticated user session', function () use ($authController, $testUserRepo) {
    $testUserRepo->clearMemory();
    $regReq = new Request('POST', '/api/auth/register', [], [], [
        'email' => 'me.user@example.com',
        'password' => 'password123',
    ]);
    $regResp = $authController->register($regReq);
    $token = $regResp->getData()['token'];

    $meReq = new Request('GET', '/api/auth/me', [], ['Authorization' => "Bearer {$token}"]);
    $meResp = $authController->me($meReq);

    assertEquals(200, $meResp->getStatusCode());
    $data = $meResp->getData();
    assertEquals('me.user@example.com', $data['user']['email']);
    assertEquals('student', $data['user']['role']);
    assertTrue(!isset($data['user']['passwordHash']));
});

runTest('GET /api/auth/me: Rejects missing Authorization header (HTTP 401)', function () use ($authController) {
    $meReq = new Request('GET', '/api/auth/me');
    $meResp = $authController->me($meReq);

    assertEquals(401, $meResp->getStatusCode());
    assertEquals(['error' => 'Missing or invalid Authorization header'], $meResp->getData());
});

runTest('GET /api/auth/me: Rejects malformed Authorization header (HTTP 401)', function () use ($authController) {
    $meReq = new Request('GET', '/api/auth/me', [], ['Authorization' => 'Basic username:password']);
    $meResp = $authController->me($meReq);

    assertEquals(401, $meResp->getStatusCode());
    assertEquals(['error' => 'Missing or invalid Authorization header'], $meResp->getData());
});

runTest('GET /api/auth/me: Rejects invalid or expired token (HTTP 401)', function () use ($authController) {
    $meReq = new Request('GET', '/api/auth/me', [], ['Authorization' => 'Bearer completely_bogus_token']);
    $meResp = $authController->me($meReq);

    assertEquals(401, $meResp->getStatusCode());
    assertEquals(['error' => 'Invalid or expired token'], $meResp->getData());
});

runTest('GET /api/auth/me: Rejects deleted/nonexistent user in token (HTTP 404)', function () use ($authController) {
    Config::set('AUTH_SECRET', 'test_secret');
    $token = Jwt::encode([
        'userId' => 'usr-deleted-999',
        'email' => 'ghost@example.com',
        'role' => 'student',
        'exp' => time() + 3600,
    ]);

    $meReq = new Request('GET', '/api/auth/me', [], ['Authorization' => "Bearer {$token}"]);
    $meResp = $authController->me($meReq);

    assertEquals(404, $meResp->getStatusCode());
    assertEquals(['error' => 'User not found'], $meResp->getData());
});

// 6. Cross-compatibility tests
runTest('Cross-Compatibility: Verifies bcrypt hash generated by Node.js bcryptjs (cost 10)', function () use ($testAuthService) {
    // Known bcrypt hash created with Node bcryptjs cost 10 for password "PathFlow2026!"
    $nodeHash = '$2b$10$yBURabDLTf.iCO9CfPkmbuABRs8wbAjm0B4DQzzMA11qDmUKBc0C2';
    $valid = $testAuthService->verifyPassword('PathFlow2026!', $nodeHash);
    assertTrue($valid, 'PHP password_verify must validate Node.js bcryptjs hash');

    $invalid = $testAuthService->verifyPassword('WrongPassword!', $nodeHash);
    assertTrue(!$invalid, 'PHP password_verify must reject incorrect password for Node.js hash');
});

runTest('Cross-Compatibility: Verifies HS256 JWT generated by Node.js format', function () {
    // Reconstruct token structure exactly as Node crypto.createHmac produces
    $secret = 'cross_compat_secret_key';
    $header = Jwt::base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = Jwt::base64UrlEncode(json_encode([
        'userId' => 'node-usr-777',
        'email' => 'node@pathflow.app',
        'role' => 'student',
        'exp' => time() + 3600,
    ]));
    $sig = Jwt::base64UrlEncode(hash_hmac('sha256', "{$header}.{$payload}", $secret, true));
    $nodeToken = "{$header}.{$payload}.{$sig}";

    $decoded = Jwt::decode($nodeToken, $secret);
    assertTrue($decoded !== null, 'PHP Jwt::decode must decode Node-generated JWT token');
    assertEquals('node-usr-777', $decoded['userId']);
    assertEquals('node@pathflow.app', $decoded['email']);
});

// ========================================================
// PHASE 3 LITE TESTS — SYNC & TEACHER ACCESS
// ========================================================

// Setup test instances for Sync and Teacher Access
$syncTestStore = new SyncStore(true);
$syncTestService = new SyncService($syncTestStore);
$syncTestController = new SyncController($syncTestService);

$teacherTestStore = new TeacherStore(true, $syncTestStore);
$teacherTestService = new TeacherService($teacherTestStore, $syncTestStore);
$teacherTestController = new TeacherController($teacherTestService);

$studentUser1 = [
    'userId' => 'student-uuid-001',
    'email' => 'student1@test.com',
    'role' => 'student',
];
$studentToken1 = Jwt::encode($studentUser1, 'test_secret');

$studentUser2 = [
    'userId' => 'student-uuid-002',
    'email' => 'student2@test.com',
    'role' => 'student',
];
$studentToken2 = Jwt::encode($studentUser2, 'test_secret');

$teacherUser = [
    'userId' => 'teacher-uuid-999',
    'email' => 'teacher@test.com',
    'role' => 'teacher',
];
$teacherJwt = Jwt::encode($teacherUser, 'test_secret');

// 1. Sync: Authentication & Role Enforcement
runTest('Sync: Rejects request missing Authorization header (HTTP 401)', function () use ($syncTestController) {
    $req = new Request('POST', '/api/sync/push', [], [], ['deviceId' => 'dev1', 'mutations' => []]);
    $resp = $syncTestController->push($req);
    assertEquals(401, $resp->getStatusCode());
    assertEquals(['error' => 'Missing or invalid Authorization header'], $resp->getData());
});

runTest('Sync: Rejects invalid or expired token (HTTP 401)', function () use ($syncTestController) {
    $req = new Request('POST', '/api/sync/push', [], ['Authorization' => 'Bearer bad_token_123'], ['deviceId' => 'dev1', 'mutations' => []]);
    $resp = $syncTestController->push($req);
    assertEquals(401, $resp->getStatusCode());
    assertEquals(['error' => 'Invalid or expired token'], $resp->getData());
});

runTest('Sync: Rejects non-student accounts attempting push (HTTP 403)', function () use ($syncTestController, $teacherJwt) {
    $req = new Request('POST', '/api/sync/push', [], ['Authorization' => "Bearer {$teacherJwt}"], ['deviceId' => 'dev1', 'mutations' => []]);
    $resp = $syncTestController->push($req);
    assertEquals(403, $resp->getStatusCode());
    assertEquals(['error' => 'Only student accounts can synchronize personal workspace data'], $resp->getData());
});

runTest('Sync: Rejects non-student accounts attempting pull (HTTP 403)', function () use ($syncTestController, $teacherJwt) {
    $req = new Request('POST', '/api/sync/pull', [], ['Authorization' => "Bearer {$teacherJwt}"], ['cursor' => null]);
    $resp = $syncTestController->pull($req);
    assertEquals(403, $resp->getStatusCode());
});

runTest('Sync: Rejects non-student accounts attempting status (HTTP 403)', function () use ($syncTestController, $teacherJwt) {
    $req = new Request('GET', '/api/sync/status', [], ['Authorization' => "Bearer {$teacherJwt}"]);
    $resp = $syncTestController->status($req);
    assertEquals(403, $resp->getStatusCode());
});

runTest('Sync: Validates push request format (HTTP 400)', function () use ($syncTestController, $studentToken1) {
    // Missing mutations
    $req1 = new Request('POST', '/api/sync/push', [], ['Authorization' => "Bearer {$studentToken1}"], ['deviceId' => 'dev1']);
    $resp1 = $syncTestController->push($req1);
    assertEquals(400, $resp1->getStatusCode());

    // Missing deviceId
    $req2 = new Request('POST', '/api/sync/push', [], ['Authorization' => "Bearer {$studentToken1}"], ['mutations' => []]);
    $resp2 = $syncTestController->push($req2);
    assertEquals(400, $resp2->getStatusCode());
});

// 2. Sync: Push Processing & Domain Entity Persistence
runTest('Sync: Successfully pushes valid mutations for all domain entities', function () use ($syncTestController, $syncTestStore, $studentToken1) {
    $syncTestStore->clearMemory();

    $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    $mutations = [
        [
            'id' => 'mut-goal-1',
            'clientMutationId' => 'cm-goal-1',
            'entityType' => 'goal',
            'entityId' => 'goal-1',
            'operation' => 'create',
            'payload' => ['title' => 'Master Machine Learning', 'description' => 'Track for ML studies', 'status' => 'in_progress'],
            'timestamp' => $now,
        ],
        [
            'id' => 'mut-road-1',
            'clientMutationId' => 'cm-road-1',
            'entityType' => 'roadmap',
            'entityId' => 'road-1',
            'operation' => 'create',
            'payload' => ['goalId' => 'goal-1', 'title' => 'Calculus & Linear Algebra'],
            'timestamp' => $now,
        ],
        [
            'id' => 'mut-task-1',
            'clientMutationId' => 'cm-task-1',
            'entityType' => 'task',
            'entityId' => 'task-1',
            'operation' => 'create',
            'payload' => ['roadmapId' => 'road-1', 'title' => 'Matrix Eigenvalues', 'estimatedMinutes' => 90, 'priority' => 'high'],
            'timestamp' => $now,
        ],
        [
            'id' => 'mut-sess-1',
            'clientMutationId' => 'cm-sess-1',
            'entityType' => 'session',
            'entityId' => 'sess-1',
            'operation' => 'create',
            'payload' => ['taskId' => 'task-1', 'startedAt' => '2026-09-28T10:00:00.000Z', 'endedAt' => '2026-09-28T11:00:00.000Z', 'durationMinutes' => 60],
            'timestamp' => $now,
        ],
        [
            'id' => 'mut-plan-1',
            'clientMutationId' => 'cm-plan-1',
            'entityType' => 'weeklyPlan',
            'entityId' => 'plan-1',
            'operation' => 'create',
            'payload' => ['weekIdentifier' => '2026-W39', 'title' => 'Week 39 Target', 'targetMinutes' => 300],
            'timestamp' => $now,
        ],
        [
            'id' => 'mut-item-1',
            'clientMutationId' => 'cm-item-1',
            'entityType' => 'weeklyPlanItem',
            'entityId' => 'item-1',
            'operation' => 'create',
            'payload' => ['weeklyPlanId' => 'plan-1', 'taskId' => 'task-1', 'plannedMinutes' => 90, 'targetDate' => '2026-09-29', 'isCompleted' => false],
            'timestamp' => $now,
        ],
    ];

    $req = new Request('POST', '/api/sync/push', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'deviceId' => 'device-macbook',
        'mutations' => $mutations,
    ]);
    $resp = $syncTestController->push($req);

    assertEquals(200, $resp->getStatusCode());
    $data = $resp->getData();
    assertEquals(6, count($data['acceptedMutationIds']));
    assertEquals(0, count($data['rejectedMutations']));
    assertTrue(isset($data['serverTimestamp']));

    // Verify stored entities
    $goals = $syncTestStore->getGoals('student-uuid-001');
    assertEquals(1, count($goals));
    assertEquals('Master Machine Learning', $goals[0]['title']);

    $roadmaps = $syncTestStore->getRoadmaps('student-uuid-001');
    assertEquals(1, count($roadmaps));
    assertEquals('Calculus & Linear Algebra', $roadmaps[0]['title']);

    $tasks = $syncTestStore->getTasks('student-uuid-001');
    assertEquals(1, count($tasks));
    assertEquals('Matrix Eigenvalues', $tasks[0]['title']);

    $sessions = $syncTestStore->getSessions('student-uuid-001');
    assertEquals(1, count($sessions));
    assertEquals(60, $sessions[0]['durationMinutes']);

    $plans = $syncTestStore->getWeeklyPlans('student-uuid-001');
    assertEquals(1, count($plans));
    assertEquals('2026-W39', $plans[0]['weekIdentifier']);

    $items = $syncTestStore->getWeeklyPlanItems('student-uuid-001');
    assertEquals(1, count($items));
    assertEquals(90, $items[0]['plannedMinutes']);
});

runTest('Sync: Rejects unsupported entity type and operation without aborting valid mutations', function () use ($syncTestController, $studentToken1) {
    $mutations = [
        [
            'id' => 'mut-bad-entity',
            'clientMutationId' => 'cm-bad-entity',
            'entityType' => 'unsupported_gadget',
            'entityId' => 'gadget-1',
            'operation' => 'create',
            'payload' => ['title' => 'Gadget'],
        ],
        [
            'id' => 'mut-bad-op',
            'clientMutationId' => 'cm-bad-op',
            'entityType' => 'goal',
            'entityId' => 'goal-2',
            'operation' => 'explode',
            'payload' => ['title' => 'Explode'],
        ],
        [
            'id' => 'mut-good-goal',
            'clientMutationId' => 'cm-good-goal',
            'entityType' => 'goal',
            'entityId' => 'goal-valid',
            'operation' => 'create',
            'payload' => ['title' => 'Valid Goal'],
        ],
    ];

    $req = new Request('POST', '/api/sync/push', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'deviceId' => 'device-macbook',
        'mutations' => $mutations,
    ]);
    $resp = $syncTestController->push($req);

    assertEquals(200, $resp->getStatusCode());
    $data = $resp->getData();
    assertEquals(['mut-good-goal'], $data['acceptedMutationIds']);
    assertEquals(2, count($data['rejectedMutations']));
    assertEquals('mut-bad-entity', $data['rejectedMutations'][0]['mutationId']);
    assertEquals('mut-bad-op', $data['rejectedMutations'][1]['mutationId']);
});

runTest('Sync: Enforces idempotency on (studentId, deviceId, clientMutationId)', function () use ($syncTestController, $syncTestStore, $studentToken1) {
    $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    $mutation = [
        'id' => 'mut-idempotent-1',
        'clientMutationId' => 'cm-idempotent-unique-123',
        'entityType' => 'goal',
        'entityId' => 'goal-idemp',
        'operation' => 'create',
        'payload' => ['title' => 'Initial Title'],
        'timestamp' => $now,
    ];

    // First push
    $req1 = new Request('POST', '/api/sync/push', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'deviceId' => 'device-idemp',
        'mutations' => [$mutation],
    ]);
    $resp1 = $syncTestController->push($req1);
    assertEquals(['mut-idempotent-1'], $resp1->getData()['acceptedMutationIds']);

    // Duplicate push with different payload - must be accepted as idempotent without re-applying side effect
    $duplicateMutation = $mutation;
    $duplicateMutation['payload'] = ['title' => 'Should Not Overwrite Title'];

    $req2 = new Request('POST', '/api/sync/push', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'deviceId' => 'device-idemp',
        'mutations' => [$duplicateMutation],
    ]);
    $resp2 = $syncTestController->push($req2);
    assertEquals(['mut-idempotent-1'], $resp2->getData()['acceptedMutationIds']);

    // Verify title was not overwritten
    $goals = $syncTestStore->getGoals('student-uuid-001');
    $goal = array_values(array_filter($goals, fn($g) => $g['id'] === 'goal-idemp'))[0];
    assertEquals('Initial Title', $goal['title']);
});

runTest('Sync: Enforces student ownership (cannot inject foreign studentId in payload)', function () use ($syncTestController, $syncTestStore, $studentToken1) {
    $mutation = [
        'id' => 'mut-spoof-1',
        'clientMutationId' => 'cm-spoof-1',
        'entityType' => 'goal',
        'entityId' => 'goal-spoofed',
        'operation' => 'create',
        'payload' => ['title' => 'Spoof Attempt', 'studentId' => 'victim-student-999'],
        'timestamp' => (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z'),
    ];

    $req = new Request('POST', '/api/sync/push', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'deviceId' => 'dev-spoof',
        'mutations' => [$mutation],
    ]);
    $syncTestController->push($req);

    // Verify entity was saved under authenticated studentId, not spoofed studentId
    $victimGoals = $syncTestStore->getGoals('victim-student-999');
    assertEquals(0, count($victimGoals));

    $studentGoals = $syncTestStore->getGoals('student-uuid-001');
    $spoofedGoal = array_values(array_filter($studentGoals, fn($g) => $g['id'] === 'goal-spoofed'))[0];
    assertEquals('student-uuid-001', $spoofedGoal['studentId']);
});

runTest('Sync: Handles delete operation by creating tombstone and deleting active domain entity', function () use ($syncTestController, $syncTestStore, $studentToken1) {
    // First, verify goal exists
    $goalsBefore = $syncTestStore->getGoals('student-uuid-001');
    $hasGoal = count(array_filter($goalsBefore, fn($g) => $g['id'] === 'goal-1')) > 0;
    assertTrue($hasGoal, 'Goal 1 should exist prior to deletion');

    $deleteTime = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    $mutation = [
        'id' => 'mut-del-1',
        'clientMutationId' => 'cm-del-1',
        'entityType' => 'goal',
        'entityId' => 'goal-1',
        'operation' => 'delete',
        'payload' => null,
        'timestamp' => $deleteTime,
    ];

    $req = new Request('POST', '/api/sync/push', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'deviceId' => 'dev1',
        'mutations' => [$mutation],
    ]);
    $resp = $syncTestController->push($req);
    assertEquals(['mut-del-1'], $resp->getData()['acceptedMutationIds']);

    // Verify active goal was deleted
    $goalsAfter = $syncTestStore->getGoals('student-uuid-001');
    $stillExists = count(array_filter($goalsAfter, fn($g) => $g['id'] === 'goal-1')) > 0;
    assertTrue(!$stillExists, 'Goal 1 should no longer exist in active table');

    // Verify tombstone was recorded
    $tombstones = $syncTestStore->getTombstonesAfter('student-uuid-001', 0);
    $goalTombstones = array_values(array_filter($tombstones, fn($t) => $t['entityId'] === 'goal-1'));
    assertEquals(1, count($goalTombstones));
    assertEquals('goal', $goalTombstones[0]['entityType']);
    assertEquals($deleteTime, $goalTombstones[0]['deletedAt']);
});

// 3. Sync: Pull Processing & Cursor Rules
runTest('Sync: Pull returns changes, tombstones, and monotonic nextCursor', function () use ($syncTestController, $studentToken1) {
    $req = new Request('POST', '/api/sync/pull', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'cursor' => ['serverVersion' => 0],
        'limit' => 50,
    ]);
    $resp = $syncTestController->pull($req);

    assertEquals(200, $resp->getStatusCode());
    $data = $resp->getData();

    assertTrue(is_array($data['changes']));
    assertTrue(is_array($data['tombstones']));
    assertTrue(isset($data['nextCursor']));
    assertTrue(isset($data['nextCursor']['serverVersion']));
    assertTrue($data['nextCursor']['serverVersion'] > 0);
    assertTrue(isset($data['hasMore']));

    // Check changes structure
    if (count($data['changes']) > 0) {
        $firstChange = $data['changes'][0];
        assertTrue(isset($firstChange['entityType']));
        assertTrue(isset($firstChange['entityId']));
        assertTrue(isset($firstChange['payload']));
        assertTrue(isset($firstChange['updatedAt']));
    }

    // Check tombstones structure
    $hasGoalTombstone = count(array_filter($data['tombstones'], fn($t) => $t['entityId'] === 'goal-1')) > 0;
    assertTrue($hasGoalTombstone, 'Pulled tombstones should include deleted goal-1');
});

runTest('Sync: Pull with high cursor returns empty changes', function () use ($syncTestController, $studentToken1) {
    $req = new Request('POST', '/api/sync/pull', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'cursor' => ['serverVersion' => 99999],
    ]);
    $resp = $syncTestController->pull($req);
    assertEquals(200, $resp->getStatusCode());
    $data = $resp->getData();
    assertEquals(0, count($data['changes']));
    assertEquals(0, count($data['tombstones']));
    assertEquals(false, $data['hasMore']);
});

runTest('Sync: Pull isolates student data (never leaks another student\'s mutations)', function () use ($syncTestController, $studentToken2) {
    // Student 2 has not made any mutations
    $req = new Request('POST', '/api/sync/pull', [], ['Authorization' => "Bearer {$studentToken2}"], [
        'cursor' => ['serverVersion' => 0],
    ]);
    $resp = $syncTestController->pull($req);
    assertEquals(200, $resp->getStatusCode());
    $data = $resp->getData();
    assertEquals(0, count($data['changes']));
    assertEquals(0, count($data['tombstones']));
});

runTest('Sync: GET /api/sync/status returns online state and student ID', function () use ($syncTestController, $studentToken1) {
    $req = new Request('GET', '/api/sync/status', [], ['Authorization' => "Bearer {$studentToken1}"]);
    $resp = $syncTestController->status($req);

    assertEquals(200, $resp->getStatusCode());
    $data = $resp->getData();
    assertEquals('idle', $data['state']);
    assertEquals(true, $data['isOnline']);
    assertEquals('student-uuid-001', $data['studentId']);
    assertTrue(isset($data['serverTime']));
});

// 4. Teacher Access: Student-side Grant Management
runTest('Teacher: Student creates grant with default permissions and high-entropy pt_ token', function () use ($teacherTestController, $studentToken1) {
    $req = new Request('POST', '/api/teacher/grants', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'label' => 'Advisor Dr. Vance',
        'ttlDays' => 30,
    ]);
    $resp = $teacherTestController->createGrant($req);

    assertEquals(201, $resp->getStatusCode());
    $data = $resp->getData();
    assertEquals('Advisor Dr. Vance', $data['label']);
    assertEquals('student-uuid-001', $data['studentId']);
    assertEquals('read_only', $data['role']);
    assertTrue(str_starts_with($data['token'], 'pt_'));
    assertTrue(strlen($data['token']) >= 32);
    assertEquals(6, count($data['permissions']));
    assertTrue(in_array('read:goals', $data['permissions']));
    assertTrue(in_array('read:reports', $data['permissions']));
    assertTrue($data['isActive']);
    assertTrue($data['expiresAt'] !== null);
});

runTest('Teacher: Grant creation rejects empty label (HTTP 400)', function () use ($teacherTestController, $studentToken1) {
    $req = new Request('POST', '/api/teacher/grants', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'label' => '   ',
    ]);
    $resp = $teacherTestController->createGrant($req);
    assertEquals(400, $resp->getStatusCode());
    assertEquals(['error' => 'Grant label is required'], $resp->getData());
});

runTest('Teacher: Non-student accounts cannot create teacher grants (HTTP 403)', function () use ($teacherTestController, $teacherJwt) {
    $req = new Request('POST', '/api/teacher/grants', [], ['Authorization' => "Bearer {$teacherJwt}"], [
        'label' => 'Illegal Grant',
    ]);
    $resp = $teacherTestController->createGrant($req);
    assertEquals(403, $resp->getStatusCode());
});

runTest('Teacher: Student lists grants (never exposes another student\'s grants)', function () use ($teacherTestController, $studentToken1, $studentToken2) {
    // Create grant for student 2
    $reqCreate2 = new Request('POST', '/api/teacher/grants', [], ['Authorization' => "Bearer {$studentToken2}"], [
        'label' => 'Student 2 Tutor',
    ]);
    $teacherTestController->createGrant($reqCreate2);

    // List student 1 grants
    $req1 = new Request('GET', '/api/teacher/grants', [], ['Authorization' => "Bearer {$studentToken1}"]);
    $resp1 = $teacherTestController->listGrants($req1);
    assertEquals(200, $resp1->getStatusCode());
    $grants1 = $resp1->getData();
    assertEquals(1, count($grants1));
    assertEquals('Advisor Dr. Vance', $grants1[0]['label']);

    // List student 2 grants
    $req2 = new Request('GET', '/api/teacher/grants', [], ['Authorization' => "Bearer {$studentToken2}"]);
    $resp2 = $teacherTestController->listGrants($req2);
    assertEquals(200, $resp2->getStatusCode());
    $grants2 = $resp2->getData();
    assertEquals(1, count($grants2));
    assertEquals('Student 2 Tutor', $grants2[0]['label']);
});

runTest('Teacher: Revoking grant performs soft-delete (isActive=false, sets revokedAt)', function () use ($teacherTestController, $studentToken1) {
    $listReq = new Request('GET', '/api/teacher/grants', [], ['Authorization' => "Bearer {$studentToken1}"]);
    $grants = $teacherTestController->listGrants($listReq)->getData();
    $grantId = $grants[0]['id'];

    $revokeReq = new Request('DELETE', "/api/teacher/grants/{$grantId}", [], ['Authorization' => "Bearer {$studentToken1}"]);
    $revokeReq->setParams(['id' => $grantId]);
    $resp = $teacherTestController->revokeGrant($revokeReq);

    assertEquals(200, $resp->getStatusCode());
    $revoked = $resp->getData();
    assertEquals(false, $revoked['isActive']);
    assertTrue($revoked['revokedAt'] !== null);
});

runTest('Teacher: Revoking nonexistent grant returns 404', function () use ($teacherTestController, $studentToken1) {
    $req = new Request('DELETE', '/api/teacher/grants/nonexistent-id', [], ['Authorization' => "Bearer {$studentToken1}"]);
    $req->setParams(['id' => 'nonexistent-id']);
    $resp = $teacherTestController->revokeGrant($req);

    assertEquals(404, $resp->getStatusCode());
    assertEquals(['error' => 'Grant not found'], $resp->getData());
});

runTest('Teacher: Student cannot revoke another student\'s grant (HTTP 403)', function () use ($teacherTestController, $studentToken1, $studentToken2) {
    // Get student 2's grant
    $listReq = new Request('GET', '/api/teacher/grants', [], ['Authorization' => "Bearer {$studentToken2}"]);
    $grants2 = $teacherTestController->listGrants($listReq)->getData();
    $grant2Id = $grants2[0]['id'];

    // Student 1 attempts to revoke it
    $req = new Request('DELETE', "/api/teacher/grants/{$grant2Id}", [], ['Authorization' => "Bearer {$studentToken1}"]);
    $req->setParams(['id' => $grant2Id]);
    $resp = $teacherTestController->revokeGrant($req);

    assertEquals(403, $resp->getStatusCode());
    assertEquals(['error' => 'Grant not owned by student'], $resp->getData());
});

// 5. Teacher Access: Token Verification & Read-Only Endpoints
runTest('Teacher: Read-only access verifies active token via X-Teacher-Token or Bearer', function () use ($teacherTestController, $teacherTestStore) {
    $mentorStudent = [
        'userId' => 'student-uuid-mentor',
        'email' => 'mentor.student@test.com',
        'role' => 'student',
    ];
    $mentorStudentToken = Jwt::encode($mentorStudent, 'test_secret');

    // Create an active grant with all permissions
    $createReq = new Request('POST', '/api/teacher/grants', [], ['Authorization' => "Bearer {$mentorStudentToken}"], [
        'label' => 'Active Mentor',
        'ttlDays' => 14,
    ]);
    $grant = $teacherTestController->createGrant($createReq)->getData();
    $token = $grant['token'];

    // Seed student with goal and task
    $teacherTestStore->getSyncStore()->upsertGoal([
        'id' => 'teacher-test-goal-1',
        'studentId' => 'student-uuid-mentor',
        'title' => 'Deep Learning Fundamentals',
        'description' => 'PyTorch & Transformers',
        'status' => 'in_progress',
        'createdAt' => '2026-09-28T00:00:00.000Z',
        'updatedAt' => '2026-09-28T00:00:00.000Z',
    ]);
    $teacherTestStore->getSyncStore()->upsertRoadmap([
        'id' => 'teacher-test-road-1',
        'studentId' => 'student-uuid-mentor',
        'goalId' => 'teacher-test-goal-1',
        'title' => 'Neural Networks',
        'createdAt' => '2026-09-28T00:00:00.000Z',
        'updatedAt' => '2026-09-28T00:00:00.000Z',
    ]);
    $teacherTestStore->getSyncStore()->upsertTask([
        'id' => 'teacher-test-task-1',
        'studentId' => 'student-uuid-mentor',
        'roadmapId' => 'teacher-test-road-1',
        'title' => 'Backpropagation exercise',
        'description' => 'Implement manual autograd',
        'status' => 'completed',
        'priority' => 'high',
        'estimatedMinutes' => 120,
        'createdAt' => '2026-09-28T00:00:00.000Z',
        'updatedAt' => '2026-09-28T00:00:00.000Z',
        'completedAt' => '2026-09-28T02:00:00.000Z',
    ]);
    $teacherTestStore->getSyncStore()->upsertSession([
        'id' => 'teacher-test-sess-1',
        'studentId' => 'student-uuid-mentor',
        'taskId' => 'teacher-test-task-1',
        'startedAt' => '2026-09-28T01:00:00.000Z',
        'endedAt' => '2026-09-28T02:00:00.000Z',
        'durationMinutes' => 60,
    ]);
    $teacherTestStore->getSyncStore()->upsertWeeklyPlan([
        'id' => 'teacher-test-plan-1',
        'studentId' => 'student-uuid-mentor',
        'weekIdentifier' => '2026-W39',
        'title' => 'Weekly Study Plan',
        'targetMinutes' => 300,
        'createdAt' => '2026-09-28T00:00:00.000Z',
        'updatedAt' => '2026-09-28T00:00:00.000Z',
    ]);
    $teacherTestStore->getSyncStore()->upsertWeeklyPlanItem([
        'id' => 'teacher-test-item-1',
        'studentId' => 'student-uuid-mentor',
        'weeklyPlanId' => 'teacher-test-plan-1',
        'taskId' => 'teacher-test-task-1',
        'targetDate' => '2026-09-28',
        'plannedMinutes' => 120,
        'isCompleted' => true,
    ]);

    // Test GET goals with X-Teacher-Token
    $reqGoals = new Request('GET', '/api/teacher/students/student-uuid-mentor/goals', [], ['X-Teacher-Token' => $token]);
    $reqGoals->setParams(['studentId' => 'student-uuid-mentor']);
    $respGoals = $teacherTestController->getGoals($reqGoals);
    assertEquals(200, $respGoals->getStatusCode());
    $goals = $respGoals->getData();
    assertEquals(1, count($goals));
    assertEquals('Deep Learning Fundamentals', $goals[0]['title']);

    // Test GET roadmaps with Authorization: Bearer <token>
    $reqRoadmaps = new Request('GET', '/api/teacher/students/student-uuid-mentor/roadmaps', [], ['Authorization' => "Bearer {$token}"]);
    $reqRoadmaps->setParams(['studentId' => 'student-uuid-mentor']);
    $respRoadmaps = $teacherTestController->getRoadmaps($reqRoadmaps);
    assertEquals(200, $respRoadmaps->getStatusCode());
    $roadmaps = $respRoadmaps->getData();
    assertEquals(1, count($roadmaps));
    assertEquals('Neural Networks', $roadmaps[0]['title']);

    // Test GET tasks
    $reqTasks = new Request('GET', '/api/teacher/students/student-uuid-mentor/tasks', [], ['X-Teacher-Token' => $token]);
    $reqTasks->setParams(['studentId' => 'student-uuid-mentor']);
    $respTasks = $teacherTestController->getTasks($reqTasks);
    assertEquals(200, $respTasks->getStatusCode());
    assertEquals('Backpropagation exercise', $respTasks->getData()[0]['title']);

    // Test GET sessions with date filter
    $reqSessions = new Request(
        'GET',
        '/api/teacher/students/student-uuid-mentor/sessions?startDate=2026-09-28T00:00:00.000Z&endDate=2026-09-28T23:59:59.999Z',
        ['startDate' => '2026-09-28T00:00:00.000Z', 'endDate' => '2026-09-28T23:59:59.999Z'],
        ['X-Teacher-Token' => $token]
    );
    $reqSessions->setParams(['studentId' => 'student-uuid-mentor']);
    $respSessions = $teacherTestController->getSessions($reqSessions);
    assertEquals(200, $respSessions->getStatusCode());
    assertEquals(1, count($respSessions->getData()));

    // Test GET weekly-plans with embedded items
    $reqPlans = new Request('GET', '/api/teacher/students/student-uuid-mentor/weekly-plans', [], ['X-Teacher-Token' => $token]);
    $reqPlans->setParams(['studentId' => 'student-uuid-mentor']);
    $respPlans = $teacherTestController->getWeeklyPlans($reqPlans);
    assertEquals(200, $respPlans->getStatusCode());
    $plans = $respPlans->getData();
    assertEquals(1, count($plans));
    assertTrue(isset($plans[0]['items']));
    assertEquals(1, count($plans[0]['items']));
    assertEquals(120, $plans[0]['items'][0]['plannedMinutes']);

    // Test GET progress
    $reqProgress = new Request('GET', '/api/teacher/students/student-uuid-mentor/progress', [], ['X-Teacher-Token' => $token]);
    $reqProgress->setParams(['studentId' => 'student-uuid-mentor']);
    $respProgress = $teacherTestController->getProgress($reqProgress);
    assertEquals(200, $respProgress->getStatusCode());
    $progress = $respProgress->getData();
    assertEquals('student-uuid-mentor', $progress['studentId']);
    assertEquals(1, $progress['totalGoals']);
    assertEquals(1, $progress['totalTasks']);
    assertEquals(1, $progress['completedTasks']);
    assertEquals(60, $progress['totalActualMinutes']);
    assertEquals(1, $progress['totalWeeklyPlans']);

    // Test GET reports
    $reqReports = new Request('GET', '/api/teacher/students/student-uuid-mentor/reports', [], ['X-Teacher-Token' => $token]);
    $reqReports->setParams(['studentId' => 'student-uuid-mentor']);
    $respReports = $teacherTestController->getReports($reqReports);
    assertEquals(200, $respReports->getStatusCode());
    $reports = $respReports->getData();
    assertEquals('student-uuid-mentor', $reports['studentId']);
    assertTrue(isset($reports['overview']));
    assertTrue(isset($reports['goals']));
    assertTrue(isset($reports['tasks']));
    assertTrue(isset($reports['weeklyPlans']));
});

runTest('Teacher: Rejects revoked token (HTTP 403)', function () use ($teacherTestController, $teacherTestStore, $studentToken1) {
    // Create and then revoke a grant
    $grant = $teacherTestController->createGrant(new Request('POST', '/api/teacher/grants', [], ['Authorization' => "Bearer {$studentToken1}"], [
        'label' => 'To Revoke',
    ]))->getData();

    $teacherTestStore->revokeGrant($grant['id'], '2026-09-28T12:00:00.000Z');

    $req = new Request('GET', '/api/teacher/students/student-uuid-001/goals', [], ['X-Teacher-Token' => $grant['token']]);
    $req->setParams(['studentId' => 'student-uuid-001']);
    $resp = $teacherTestController->getGoals($req);

    assertEquals(403, $resp->getStatusCode());
    assertEquals(['error' => 'Teacher access grant has been revoked by the student'], $resp->getData());
});

runTest('Teacher: Rejects expired token (HTTP 403)', function () use ($teacherTestController, $teacherTestStore) {
    // Manually insert an expired grant into store
    $expiredGrant = $teacherTestStore->createGrant([
        'studentId' => 'student-uuid-001',
        'label' => 'Expired Grant',
        'token' => 'pt_expired_token_123',
        'permissions' => ['read:goals'],
        'createdAt' => '2026-08-01T00:00:00.000Z',
        'expiresAt' => '2026-08-10T00:00:00.000Z', // In the past
        'isActive' => true,
    ]);

    $req = new Request('GET', '/api/teacher/students/student-uuid-001/goals', [], ['X-Teacher-Token' => 'pt_expired_token_123']);
    $req->setParams(['studentId' => 'student-uuid-001']);
    $resp = $teacherTestController->getGoals($req);

    assertEquals(403, $resp->getStatusCode());
    assertEquals(['error' => 'Teacher access grant has expired'], $resp->getData());
});

runTest('Teacher: Rejects token unauthorized for requested studentId (HTTP 403)', function () use ($teacherTestController, $teacherTestStore) {
    // Grant belongs to student-uuid-001
    $grant = $teacherTestStore->createGrant([
        'studentId' => 'student-uuid-001',
        'label' => 'Student 1 Grant',
        'token' => 'pt_student1_token',
        'permissions' => ['read:goals'],
        'createdAt' => '2026-09-28T00:00:00.000Z',
        'isActive' => true,
    ]);

    // Teacher tries to use student 1 token to read student 2's data
    $req = new Request('GET', '/api/teacher/students/student-uuid-002/goals', [], ['X-Teacher-Token' => 'pt_student1_token']);
    $req->setParams(['studentId' => 'student-uuid-002']);
    $resp = $teacherTestController->getGoals($req);

    assertEquals(403, $resp->getStatusCode());
    assertEquals(['error' => 'Access token is not authorized for this student'], $resp->getData());
});

runTest('Teacher: Rejects request missing required permission (HTTP 403)', function () use ($teacherTestController, $teacherTestStore) {
    // Grant with only read:goals
    $teacherTestStore->createGrant([
        'studentId' => 'student-uuid-001',
        'label' => 'Goals Only Grant',
        'token' => 'pt_goals_only',
        'permissions' => ['read:goals'],
        'createdAt' => '2026-09-28T00:00:00.000Z',
        'isActive' => true,
    ]);

    // Attempt to access sessions
    $req = new Request('GET', '/api/teacher/students/student-uuid-001/sessions', [], ['X-Teacher-Token' => 'pt_goals_only']);
    $req->setParams(['studentId' => 'student-uuid-001']);
    $resp = $teacherTestController->getSessions($req);

    assertEquals(403, $resp->getStatusCode());
    assertTrue(str_contains($resp->getData()['error'], 'missing required permission: "read:sessions"'));
});

// 6. Strict Teacher Mutation Rejection Handler
runTest('Teacher: Strict rejection of mutation operations (POST, PUT, PATCH, DELETE) against student paths (HTTP 403)', function () use ($teacherTestController) {
    $methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    foreach ($methods as $method) {
        $req = new Request($method, '/api/teacher/students/student-uuid-001/tasks');
        $resp = $teacherTestController->rejectMutation($req);

        assertEquals(403, $resp->getStatusCode(), "Method {$method} must be rejected with 403");
        assertEquals(
            ['error' => 'Teacher access is strictly read-only. Mutation operations are prohibited.'],
            $resp->getData()
        );
    }
});

// 7. Security & Injection Resilience Tests
runTest('Security: Handles SQL injection payloads in query and parameters safely without crashing', function () use ($teacherTestController) {
    $sqliToken = "' OR '1'='1";
    $req = new Request('GET', '/api/teacher/students/student-uuid-001/goals', [], ['X-Teacher-Token' => $sqliToken]);
    $req->setParams(['studentId' => "student-uuid-001' OR '1'='1"]);
    $resp = $teacherTestController->getGoals($req);

    assertEquals(403, $resp->getStatusCode());
});

runTest('Security: Malformed JSON payloads return safe error response without exposing server internals', function () use ($syncTestController, $studentToken1) {
    $req = new Request('POST', '/api/sync/push', [], ['Authorization' => "Bearer {$studentToken1}"], 'INVALID_NOT_JSON');
    $resp = $syncTestController->push($req);

    assertEquals(400, $resp->getStatusCode());
    assertEquals(['error' => 'Invalid push request. Must contain deviceId and mutations array.'], $resp->getData());
});

// ========================================================
// PHASE 5 SHARED HOSTING & PRODUCTION ENVIRONMENT TESTS
// ========================================================

runTest('Phase 5: CORS supports CORS_ALLOWED_ORIGINS alias and matches explicit origin', function () {
    Config::set('CORS_ORIGIN', null);
    Config::set('CORS_ALLOWED_ORIGINS', 'https://app.pathflow.example,https://pathflow.example');

    $resolved = Cors::resolveAllowedOrigin('https://app.pathflow.example');
    assertEquals('https://app.pathflow.example', $resolved);

    $unmatched = Cors::resolveAllowedOrigin('https://evil.attacker.example');
    assertEquals('https://app.pathflow.example', $unmatched, 'Should fallback to first allowed origin when unmatched');
});

runTest('Phase 5: Request extracts REDIRECT_HTTP_AUTHORIZATION under Apache FastCGI/CGI', function () {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['REQUEST_URI'] = '/api/auth/me';
    unset($_SERVER['HTTP_AUTHORIZATION']);
    $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] = 'Bearer fastcgi_token_abc123';

    $req = Request::createFromGlobals();
    assertEquals('Bearer fastcgi_token_abc123', $req->getHeader('authorization'));
    assertEquals('fastcgi_token_abc123', $req->getBearerToken());

    unset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
});

runTest('Phase 5: Request extracts REDIRECT_HTTP_X_TEACHER_TOKEN under Apache FastCGI/CGI', function () {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['REQUEST_URI'] = '/api/teacher/students/st_1/goals';
    unset($_SERVER['HTTP_X_TEACHER_TOKEN']);
    $_SERVER['REDIRECT_HTTP_X_TEACHER_TOKEN'] = 'pt_fastcgi_teacher_xyz';

    $req = Request::createFromGlobals();
    assertEquals('pt_fastcgi_teacher_xyz', $req->getHeader('x-teacher-token'));
    assertEquals('pt_fastcgi_teacher_xyz', $req->getTeacherToken());

    unset($_SERVER['REDIRECT_HTTP_X_TEACHER_TOKEN']);
});

runTest('Phase 5: Database initialization and schema files exist and are valid with pf_ prefix', function () {
    $schemaPath = dirname(__DIR__) . '/database/schema.sql';
    assertTrue(file_exists($schemaPath), 'schema.sql must exist');
    $content = file_get_contents($schemaPath);
    assertTrue(str_contains($content, 'CREATE TABLE IF NOT EXISTS `pf_User`'));
    assertTrue(str_contains($content, 'CREATE TABLE IF NOT EXISTS `pf_TeacherAccessGrant`'));
    assertTrue(str_contains($content, 'REFERENCES `pf_User`'));
    assertTrue(!str_contains($content, '5bez_'));
    assertTrue(str_contains($content, 'ENGINE=InnoDB'));

    $initScript = dirname(__DIR__) . '/database/init.php';
    assertTrue(file_exists($initScript), 'init.php must exist');
});

runTest('Phase 5: Apache .htaccess security files exist and protect sensitive data', function () {
    $publicHtaccess = dirname(__DIR__) . '/public/.htaccess';
    assertTrue(file_exists($publicHtaccess), 'backend/public/.htaccess must exist');
    $publicContent = file_get_contents($publicHtaccess);
    assertTrue(str_contains($publicContent, 'RewriteEngine On'));
    assertTrue(str_contains($publicContent, 'Options -Indexes'));
    assertTrue(str_contains($publicContent, 'HTTP_AUTHORIZATION'));
    assertTrue(str_contains($publicContent, 'HTTP_X_TEACHER_TOKEN'));

    $backendHtaccess = dirname(__DIR__) . '/.htaccess';
    assertTrue(file_exists($backendHtaccess), 'backend/.htaccess must exist');
    $backendContent = file_get_contents($backendHtaccess);
    assertTrue(str_contains($backendContent, 'Require all denied') || str_contains($backendContent, 'Deny from all'));
});

// ========================================================
// TABLE PREFIX ISOLATION TESTS (WordPress Coexistence)
// ========================================================

runTest('Table Prefix: Defaults to pf_ and formats table identifier with backticks', function () {
    Config::set('DB_TABLE_PREFIX', null);
    assertEquals('pf_', Database::getPrefix());
    assertEquals('`pf_User`', Database::table('User'));
    assertEquals('`pf_TeacherAccessGrant`', Database::table('TeacherAccessGrant'));
    assertEquals('pf_User', Database::rawTable('User'));
    assertEquals('pf_TeacherAccessGrant', Database::rawTable('TeacherAccessGrant'));
});

runTest('Table Prefix: Resolves all 10 PathFlow domain tables with configured prefix', function () {
    Config::set('DB_TABLE_PREFIX', 'pf_');
    $expected = [
        'User' => '`pf_User`',
        'Goal' => '`pf_Goal`',
        'Roadmap' => '`pf_Roadmap`',
        'Task' => '`pf_Task`',
        'Session' => '`pf_Session`',
        'WeeklyPlan' => '`pf_WeeklyPlan`',
        'WeeklyPlanItem' => '`pf_WeeklyPlanItem`',
        'SyncMutationRecord' => '`pf_SyncMutationRecord`',
        'Tombstone' => '`pf_Tombstone`',
        'TeacherAccessGrant' => '`pf_TeacherAccessGrant`',
    ];

    foreach ($expected as $logical => $physicalQuoted) {
        assertEquals($physicalQuoted, Database::table($logical), "Logical table {$logical} must map to {$physicalQuoted}");
    }
});

runTest('Table Prefix: Supports custom prefix configuration', function () {
    Config::set('DB_TABLE_PREFIX', 'custom_prefix_');
    assertEquals('custom_prefix_', Database::getPrefix());
    assertEquals('`custom_prefix_User`', Database::table('User'));
    assertEquals('`custom_prefix_Task`', Database::table('Task'));
    assertEquals('custom_prefix_Roadmap', Database::rawTable('Roadmap'));

    // Reset back to pf_
    Config::set('DB_TABLE_PREFIX', 'pf_');
});

runTest('Table Prefix: Strictly validates prefix against injection pattern ^[A-Za-z0-9_]*$', function () {
    $maliciousPrefixes = [
        "pf_'; DROP TABLE users; --",
        'pf-test', // dashes not allowed
        'pf prefix', // spaces not allowed
        'pf$table',
    ];

    foreach ($maliciousPrefixes as $badPrefix) {
        Config::set('DB_TABLE_PREFIX', $badPrefix);
        $caught = false;
        try {
            Database::getPrefix();
        } catch (\InvalidArgumentException $e) {
            $caught = true;
        }
        assertTrue($caught, "Malicious prefix '{$badPrefix}' must be rejected with InvalidArgumentException");
    }

    // Reset back to pf_
    Config::set('DB_TABLE_PREFIX', 'pf_');
});

runTest('Table Prefix: Strictly rejects untrusted logical table names', function () {
    $untrustedTables = [
        '5bez_posts',
        '5bez_options',
        '5bez_users',
        'wp_users',
        'non_existent_table',
        'User; DROP TABLE `pf_User`;',
    ];

    foreach ($untrustedTables as $badTable) {
        $caught = false;
        try {
            Database::table($badTable);
        } catch (\InvalidArgumentException $e) {
            $caught = true;
        }
        assertTrue($caught, "Untrusted logical table '{$badTable}' must be rejected with InvalidArgumentException");
    }
});

runTest('Table Prefix: Database::sql safely replaces trusted {{Table}} placeholders', function () {
    Config::set('DB_TABLE_PREFIX', 'pf_');
    $query = 'SELECT u.id FROM {{User}} u JOIN {{Goal}} g ON u.id = g.studentId WHERE u.email = :email';
    $resolved = Database::sql($query);
    assertEquals('SELECT u.id FROM `pf_User` u JOIN `pf_Goal` g ON u.id = g.studentId WHERE u.email = :email', $resolved);
});

runTest('Table Prefix: Complete isolation from WordPress 5bez_* tables', function () {
    // Verify that PathFlow logical tables and physical tables are disjoint from 5bez_*
    foreach (Database::LOGICAL_TABLES as $logical) {
        $physical = Database::rawTable($logical);
        assertTrue(!str_starts_with($physical, '5bez_'), "Table {$physical} must not use 5bez_ prefix");
        assertTrue(str_starts_with($physical, 'pf_'), "Table {$physical} must use pf_ prefix");
    }
});

echo "\n========================================================\n";
echo " Summary: {$passedTests}/{$totalTests} tests passed.\n";
echo "========================================================\n";

if ($failedTests > 0) {
    exit(1);
}
exit(0);
