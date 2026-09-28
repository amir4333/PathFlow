<?php

declare(strict_types=1);

namespace PathFlow\Auth;

use PathFlow\Http\Request;
use PathFlow\Http\Response;

/**
 * Authentication Middleware.
 * Validates Bearer tokens and resolves the authenticated User from database.
 */
class AuthMiddleware
{
    /**
     * Authenticate request using Bearer JWT token.
     *
     * @param Request $request
     * @param UserRepository|null $userRepository
     * @return array|Response Returns associative user array on success, or Response error on failure.
     */
    public static function authenticate(Request $request, ?UserRepository $userRepository = null): array|Response
    {
        $token = $request->getBearerToken();
        if ($token === null || $token === '') {
            return Response::error('Missing or invalid Authorization header', 401);
        }

        $decoded = Jwt::decode($token);
        if ($decoded === null || empty($decoded['userId'])) {
            return Response::error('Invalid or expired token', 401);
        }

        $repo = $userRepository ?? UserRepository::getInstance();
        $user = $repo->findById((string)$decoded['userId']);

        if ($user === null) {
            return Response::error('User not found', 404);
        }

        return $user;
    }
}
