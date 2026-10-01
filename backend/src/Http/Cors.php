<?php

declare(strict_types=1);

namespace PathFlow\Http;

use PathFlow\Config\Config;

/**
 * CORS handling service.
 * Manages allowed origins, credentials, allowed headers, and pre-flight OPTIONS requests.
 */
class Cors
{
    /**
     * Resolve allowed origin based on client request Origin header and CORS_ORIGIN configuration.
     */
    public static function resolveAllowedOrigin(?string $requestOrigin): string
    {
        $configured = Config::get('CORS_ORIGIN') ?? Config::get('CORS_ALLOWED_ORIGINS', '*');

        if ($configured === '*' || empty($configured)) {
            return $requestOrigin ?? '*';
        }

        // Support multiple comma-separated origins (e.g. "http://localhost:3000,http://127.0.0.1:3000")
        $origins = array_map('trim', explode(',', (string)$configured));

        if ($requestOrigin && in_array($requestOrigin, $origins, true)) {
            return $requestOrigin;
        }

        // Return first configured origin or fallback
        return $origins[0] ?? '*';
    }

    /**
     * Apply standard CORS headers to response or send directly for pre-flight requests.
     */
    public static function handle(Request $request): ?Response
    {
        $requestOrigin = $request->getHeader('origin');
        $allowedOrigin = self::resolveAllowedOrigin($requestOrigin);

        $headers = [
            'Access-Control-Allow-Origin' => $allowedOrigin,
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Teacher-Token, Accept, Origin',
            'Access-Control-Max-Age' => '86400',
        ];

        if ($allowedOrigin !== '*') {
            $headers['Access-Control-Allow-Credentials'] = 'true';
            $headers['Vary'] = 'Origin';
        }

        // Handle preflight OPTIONS request
        if ($request->getMethod() === 'OPTIONS') {
            return Response::empty(200, $headers);
        }

        return null;
    }

    /**
     * Attach CORS headers to an outgoing Response object.
     */
    public static function attachHeaders(Response $response, Request $request): Response
    {
        $requestOrigin = $request->getHeader('origin');
        $allowedOrigin = self::resolveAllowedOrigin($requestOrigin);

        $response->setHeader('Access-Control-Allow-Origin', $allowedOrigin);
        $response->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Teacher-Token, Accept, Origin');

        if ($allowedOrigin !== '*') {
            $response->setHeader('Access-Control-Allow-Credentials', 'true');
            $response->setHeader('Vary', 'Origin');
        }

        return $response;
    }
}
