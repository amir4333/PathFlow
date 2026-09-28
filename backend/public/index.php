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
