<?php

declare(strict_types=1);

namespace PathFlow\Router;

use PathFlow\Http\Request;
use PathFlow\Http\Response;

/**
 * Lightweight HTTP Router supporting GET, POST, PUT, PATCH, DELETE and parameterized routes
 * e.g. /api/teacher/students/:studentId/goals
 */
class Router
{
    private array $routes = [];

    public function get(string $path, callable $handler): self
    {
        return $this->addRoute('GET', $path, $handler);
    }

    public function post(string $path, callable $handler): self
    {
        return $this->addRoute('POST', $path, $handler);
    }

    public function put(string $path, callable $handler): self
    {
        return $this->addRoute('PUT', $path, $handler);
    }

    public function patch(string $path, callable $handler): self
    {
        return $this->addRoute('PATCH', $path, $handler);
    }

    public function delete(string $path, callable $handler): self
    {
        return $this->addRoute('DELETE', $path, $handler);
    }

    public function any(string $path, callable $handler): self
    {
        return $this->addRoute('*', $path, $handler);
    }

    private function addRoute(string $method, string $path, callable $handler): self
    {
        // Normalize path
        $cleanPath = '/' . trim($path, '/');
        if ($cleanPath !== '/' && str_ends_with($cleanPath, '/')) {
            $cleanPath = rtrim($cleanPath, '/');
        }

        $this->routes[] = [
            'method' => strtoupper($method),
            'path' => $cleanPath,
            'handler' => $handler,
        ];

        return $this;
    }

    /**
     * Dispatch an incoming Request against registered routes.
     * Extracts named URL parameters (e.g. :studentId).
     */
    public function dispatch(Request $request): Response
    {
        $requestMethod = $request->getMethod();
        $requestPath = '/' . trim($request->getPath(), '/');
        if ($requestPath !== '/' && str_ends_with($requestPath, '/')) {
            $requestPath = rtrim($requestPath, '/');
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== '*' && $route['method'] !== $requestMethod) {
                continue;
            }

            $matches = $this->matchPath($route['path'], $requestPath);
            if ($matches !== null) {
                $request->setParams($matches);
                $handler = $route['handler'];
                $result = $handler($request);

                if ($result instanceof Response) {
                    return $result;
                }

                if (is_array($result)) {
                    return Response::json($result);
                }

                return Response::ok($result);
            }
        }

        return Response::error(sprintf('Route not found: %s %s', $requestMethod, $requestPath), 404);
    }

    /**
     * Match route template against requested path and extract parameters.
     */
    private function matchPath(string $routePattern, string $path): ?array
    {
        // Exact match check
        if ($routePattern === $path) {
            return [];
        }

        // Support wildcard routes (e.g. /api/teacher/students/:studentId/*)
        $pattern = preg_replace_callback('/:([a-zA-Z0-9_]+)/', function ($matches) {
            return '(?P<' . $matches[1] . '>[^/]+)';
        }, $routePattern);

        $pattern = str_replace('/*', '/(?P<wildcard>.*)', $pattern);
        $regex = '#^' . $pattern . '$#';

        if (preg_match($regex, $path, $matches)) {
            $params = [];
            foreach ($matches as $key => $val) {
                if (is_string($key)) {
                    $params[$key] = $val;
                }
            }
            return $params;
        }

        return null;
    }

    public function getRoutes(): array
    {
        return $this->routes;
    }
}
