<?php

declare(strict_types=1);

namespace PathFlow\Http;

/**
 * Lightweight JSON Response abstraction for PathFlow REST API.
 */
class Response
{
    private int $statusCode;
    private array $headers;
    private mixed $data;

    public function __construct(mixed $data = null, int $statusCode = 200, array $headers = [])
    {
        $this->data = $data;
        $this->statusCode = $statusCode;
        $this->headers = $headers;
    }

    /**
     * Create a standard JSON response.
     */
    public static function json(mixed $data, int $statusCode = 200, array $headers = []): self
    {
        $headers['Content-Type'] = 'application/json; charset=utf-8';
        return new self($data, $statusCode, $headers);
    }

    /**
     * Standard error JSON response matching:
     * { "error": "..." }
     */
    public static function error(string $message, int $statusCode = 400, array $headers = []): self
    {
        return self::json(['error' => $message], $statusCode, $headers);
    }

    /**
     * Standard success/ok response.
     */
    public static function ok(mixed $data, array $headers = []): self
    {
        return self::json($data, 200, $headers);
    }

    /**
     * Standard 201 Created response.
     */
    public static function created(mixed $data, array $headers = []): self
    {
        return self::json($data, 201, $headers);
    }

    /**
     * Standard empty response (e.g. 204 No Content or 200 OPTIONS).
     */
    public static function empty(int $statusCode = 204, array $headers = []): self
    {
        return new self(null, $statusCode, $headers);
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getHeaders(): array
    {
        return $this->headers;
    }

    public function getData(): mixed
    {
        return $this->data;
    }

    public function setHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    /**
     * Send HTTP status code, headers, and serialized body to client.
     */
    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->statusCode);
            foreach ($this->headers as $name => $value) {
                header(sprintf('%s: %s', $name, $value));
            }
        }

        if ($this->data !== null) {
            echo json_encode($this->data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
    }
}
