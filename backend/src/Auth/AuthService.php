<?php

declare(strict_types=1);

namespace PathFlow\Auth;

use PathFlow\Support\Uuid;

/**
 * Authentication Service handling password hashing, credential verification,
 * user registration, and JWT token issuance.
 */
class AuthService
{
    private UserRepository $userRepository;

    public function __construct(?UserRepository $userRepository = null)
    {
        $this->userRepository = $userRepository ?? UserRepository::getInstance();
    }

    /**
     * Hash password using standard bcrypt with cost 10.
     * 100% compatible with Node.js bcryptjs (cost 10).
     */
    public function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
    }

    /**
     * Verify password against bcrypt hash.
     */
    public function verifyPassword(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    /**
     * Generate an HMAC-SHA256 signed bearer token.
     */
    public function generateToken(array $user, int $expiresInHours = 72): string
    {
        $payload = [
            'userId' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'exp' => time() + ($expiresInHours * 3600),
        ];

        return Jwt::encode($payload);
    }

    /**
     * Verify bearer token signature and expiration.
     */
    public function verifyToken(string $token): ?array
    {
        return Jwt::decode($token);
    }

    /**
     * Sanitize user object for client responses (removes passwordHash).
     */
    public static function formatPublicUser(array $user): array
    {
        return [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
        ];
    }
}
