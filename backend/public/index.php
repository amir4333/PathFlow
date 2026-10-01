<?php

declare(strict_types=1);

// Register PathFlow PSR-4 Autoloader
require_once dirname(__DIR__) . '/src/Support/Autoloader.php';
\PathFlow\Support\Autoloader::register();

use PathFlow\Config\Config;
use PathFlow\Http\Request;
use PathFlow\Http\Response;
use PathFlow\Http\Cors;
use PathFlow\Router\Router;
use PathFlow\Auth\AuthController;
use PathFlow\Sync\SyncController;
use PathFlow\Teacher\TeacherController;

// 1. Initialize environment configuration
Config::load();

// 2. Create HTTP Request
$request = Request::createFromGlobals();

// 3. Handle CORS (preflight OPTIONS or origin headers)
$corsResponse = Cors::handle($request);
if ($corsResponse !== null) {
    $corsResponse->send();
    exit(0);
}

// 4. Initialize Router and register endpoints
$router = new Router();
$authController = new AuthController();
$syncController = new SyncController();
$teacherController = new TeacherController();

/**
 * GET /api/health
 * Public health check probe matching Fastify contract exactly:
 * { "status": "ok", "timestamp": "ISO-8601 UTC timestamp" }
 */
$router->get('/api/health', function (Request $req): Response {
    $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    return Response::ok([
        'status' => 'ok',
        'timestamp' => $now,
    ]);
});

/**
 * Authentication Endpoints (Phase 2)
 */
$router->post('/api/auth/register', function (Request $req) use ($authController): Response {
    return $authController->register($req);
});

$router->post('/api/auth/login', function (Request $req) use ($authController): Response {
    return $authController->login($req);
});

$router->get('/api/auth/me', function (Request $req) use ($authController): Response {
    return $authController->me($req);
});

/**
 * Synchronization Endpoints (Phase 3 Lite)
 */
$router->post('/api/sync/push', function (Request $req) use ($syncController): Response {
    return $syncController->push($req);
});

$router->post('/api/sync/pull', function (Request $req) use ($syncController): Response {
    return $syncController->pull($req);
});

$router->get('/api/sync/status', function (Request $req) use ($syncController): Response {
    return $syncController->status($req);
});

/**
 * Teacher Access Endpoints (Phase 3 Lite)
 */
// Student-side grant management
$router->post('/api/teacher/grants', function (Request $req) use ($teacherController): Response {
    return $teacherController->createGrant($req);
});

$router->get('/api/teacher/grants', function (Request $req) use ($teacherController): Response {
    return $teacherController->listGrants($req);
});

$router->delete('/api/teacher/grants/:id', function (Request $req) use ($teacherController): Response {
    return $teacherController->revokeGrant($req);
});

// Teacher-side read-only inspection
$router->get('/api/teacher/students/:studentId/goals', function (Request $req) use ($teacherController): Response {
    return $teacherController->getGoals($req);
});

$router->get('/api/teacher/students/:studentId/roadmaps', function (Request $req) use ($teacherController): Response {
    return $teacherController->getRoadmaps($req);
});

$router->get('/api/teacher/students/:studentId/tasks', function (Request $req) use ($teacherController): Response {
    return $teacherController->getTasks($req);
});

$router->get('/api/teacher/students/:studentId/sessions', function (Request $req) use ($teacherController): Response {
    return $teacherController->getSessions($req);
});

$router->get('/api/teacher/students/:studentId/weekly-plans', function (Request $req) use ($teacherController): Response {
    return $teacherController->getWeeklyPlans($req);
});

$router->get('/api/teacher/students/:studentId/progress', function (Request $req) use ($teacherController): Response {
    return $teacherController->getProgress($req);
});

$router->get('/api/teacher/students/:studentId/reports', function (Request $req) use ($teacherController): Response {
    return $teacherController->getReports($req);
});

// Strict rejection of mutation operations on student records by teachers
$router->post('/api/teacher/students/:studentId/*', function (Request $req) use ($teacherController): Response {
    return $teacherController->rejectMutation($req);
});

$router->put('/api/teacher/students/:studentId/*', function (Request $req) use ($teacherController): Response {
    return $teacherController->rejectMutation($req);
});

$router->patch('/api/teacher/students/:studentId/*', function (Request $req) use ($teacherController): Response {
    return $teacherController->rejectMutation($req);
});

$router->delete('/api/teacher/students/:studentId/*', function (Request $req) use ($teacherController): Response {
    return $teacherController->rejectMutation($req);
});

// 5. Dispatch Request and catch any uncaught exceptions
try {
    $response = $router->dispatch($request);
} catch (\Throwable $e) {
    $statusCode = 500;
    $message = Config::getBool('APP_DEBUG', false)
        ? sprintf('Server error: %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine())
        : 'Internal server error';

    $response = Response::error($message, $statusCode);
}

// 6. Attach CORS headers to response and send
$response = Cors::attachHeaders($response, $request);
$response->send();
