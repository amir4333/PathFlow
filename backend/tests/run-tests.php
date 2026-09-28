<?php

declare(strict_types=1);

// Test Runner for PathFlow PHP Backend
// Validates Phase 1 Foundation & Phase 2 Authentication Suite

require_once dirname(__DIR__) . '/src/Support/Autoloader.php';
\PathFlow\Support\Autoloader::register();

use PathFlow\Config\Config;
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

runTest('Schema SQL: Contains all 10 required tables and InnoDB engine', function () {
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
            str_contains($sql, "CREATE TABLE IF NOT EXISTS `{$table}`") || str_contains($sql, "CREATE TABLE `{$table}`"),
            "Table {$table} must be defined in schema.sql"
        );
    }

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

echo "\n========================================================\n";
echo " Summary: {$passedTests}/{$totalTests} tests passed.\n";
echo "========================================================\n";

if ($failedTests > 0) {
    exit(1);
}
exit(0);
