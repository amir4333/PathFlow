<?php

declare(strict_types=1);

namespace PathFlow\Http;

/**
 * Lightweight HTTP Request representation.
 * Extracts method, URI, query parameters, parsed JSON body, and headers.
 */
class Request
{
    private string $method;
    private string $uri;
    private string $path;
    private array $queryParams;
    private array $headers;
    private mixed $body;
    private array $params = [];

    public function __construct(
        string $method,
        string $uri,
        array $queryParams = [],
        array $headers = [],
        mixed $body = null
    ) {
        $this->method = strtoupper($method);
        $this->uri = $uri;
        $this->path = parse_url($uri, PHP_URL_PATH) ?? '/';
        $this->queryParams = $queryParams;
        $this->headers = array_change_key_case($headers, CASE_LOWER);
        $this->body = $body;
    }

    /**
     * Create Request from PHP globals ($_SERVER, $_GET, php://input).
     */
    public static function createFromGlobals(): self
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri = $_SERVER['REQUEST_URI'] ?? '/';

        // Strip script name or subfolder if routed via subdirectory
        $path = parse_url($uri, PHP_URL_PATH) ?? '/';

        // Extract headers
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = str_replace('_', '-', strtolower(substr($key, 5)));
                $headers[$name] = $value;
            } elseif (in_array($key, ['CONTENT_TYPE', 'CONTENT_LENGTH'], true)) {
                $name = str_replace('_', '-', strtolower($key));
                $headers[$name] = $value;
            }
        }

        // Support Apache authorization header workaround if not captured in HTTP_AUTHORIZATION
        if (!isset($headers['authorization'])) {
            if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
                $headers['authorization'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
            } elseif (function_exists('apache_request_headers')) {
                $apacheHeaders = apache_request_headers();
                if (isset($apacheHeaders['Authorization'])) {
                    $headers['authorization'] = $apacheHeaders['Authorization'];
                } elseif (isset($apacheHeaders['authorization'])) {
                    $headers['authorization'] = $apacheHeaders['authorization'];
                }
            }
        }

        // Support Apache X-Teacher-Token workaround if redirected or under FastCGI
        if (!isset($headers['x-teacher-token'])) {
            if (isset($_SERVER['REDIRECT_HTTP_X_TEACHER_TOKEN'])) {
                $headers['x-teacher-token'] = $_SERVER['REDIRECT_HTTP_X_TEACHER_TOKEN'];
            } elseif (function_exists('apache_request_headers')) {
                $apacheHeaders = apache_request_headers();
                foreach ($apacheHeaders as $k => $v) {
                    if (strcasecmp($k, 'X-Teacher-Token') === 0) {
                        $headers['x-teacher-token'] = $v;
                        break;
                    }
                }
            }
        }

        // Parse JSON body if present
        $rawInput = file_get_contents('php://input');
        $body = null;
        if ($rawInput !== false && trim($rawInput) !== '') {
            $decoded = json_decode($rawInput, true);
            $body = (json_last_error() === JSON_ERROR_NONE) ? $decoded : $rawInput;
        }

        return new self($method, $uri, $_GET, $headers, $body);
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function getQueryParams(): array
    {
        return $this->queryParams;
    }

    public function getQuery(string $key, mixed $default = null): mixed
    {
        return $this->queryParams[$key] ?? $default;
    }

    public function getHeaders(): array
    {
        return $this->headers;
    }

    public function getHeader(string $name): ?string
    {
        $normalized = strtolower($name);
        return $this->headers[$normalized] ?? null;
    }

    public function getBearerToken(): ?string
    {
        $auth = $this->getHeader('authorization');
        if ($auth && preg_match('/^Bearer\s+(.+)$/i', trim($auth), $matches)) {
            return trim($matches[1]);
        }
        return null;
    }

    public function getTeacherToken(): ?string
    {
        $customHeader = $this->getHeader('x-teacher-token');
        if ($customHeader && trim($customHeader) !== '') {
            return trim($customHeader);
        }
        return $this->getBearerToken();
    }

    public function getBody(): mixed
    {
        return $this->body;
    }

    public function getJson(): ?array
    {
        return is_array($this->body) ? $this->body : null;
    }

    public function setParams(array $params): void
    {
        $this->params = $params;
    }

    public function getParam(string $key, ?string $default = null): ?string
    {
        return $this->params[$key] ?? $default;
    }

    public function getParams(): array
    {
        return $this->params;
    }
}
