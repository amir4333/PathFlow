<?php

declare(strict_types=1);

namespace PathFlow\Auth;

use PathFlow\Http\Request;
use PathFlow\Http\Response;
use PathFlow\Support\Uuid;

/**
 * Controller handling user registration, authentication, and session identity.
 */
class AuthController
{
    private UserRepository $userRepository;
    private AuthService $authService;

    public function __construct(
        ?UserRepository $userRepository = null,
        ?AuthService $authService = null
    ) {
        $this->userRepository = $userRepository ?? UserRepository::getInstance();
        $this->authService = $authService ?? new AuthService($this->userRepository);
    }

    /**
     * POST /api/auth/register
     */
    public function register(Request $request): Response
    {
        $body = $request->getJson() ?? [];

        $rawEmail = isset($body['email']) ? (string)$body['email'] : '';
        $password = isset($body['password']) ? (string)$body['password'] : '';
        $role = isset($body['role']) ? (string)$body['role'] : 'student';

        $trimmedEmail = trim($rawEmail);
        if ($trimmedEmail === '' || !str_contains($trimmedEmail, '@')) {
            return Response::error('Valid email is required', 400);
        }

        if (strlen($password) < 6) {
            return Response::error('Password must be at least 6 characters', 400);
        }

        if ($role !== 'student' && $role !== 'teacher') {
            return Response::error('Role must be student or teacher', 400);
        }

        $normalizedEmail = strtolower($trimmedEmail);

        // Check for existing user
        $existing = $this->userRepository->findByEmail($normalizedEmail);
        if ($existing !== null) {
            return Response::error('Email already registered', 409);
        }

        // Hash password with bcrypt cost 10
        $passwordHash = $this->authService->hashPassword($password);
        $userId = Uuid::v4();

        $user = $this->userRepository->create($userId, $normalizedEmail, $passwordHash, $role);
        $token = $this->authService->generateToken($user);

        return Response::created([
            'user' => AuthService::formatPublicUser($user),
            'token' => $token,
        ]);
    }

    /**
     * POST /api/auth/login
     */
    public function login(Request $request): Response
    {
        $body = $request->getJson() ?? [];

        $rawEmail = isset($body['email']) ? (string)$body['email'] : '';
        $password = isset($body['password']) ? (string)$body['password'] : '';

        $trimmedEmail = trim($rawEmail);
        if ($trimmedEmail === '' || $password === '') {
            return Response::error('Email and password are required', 400);
        }

        $normalizedEmail = strtolower($trimmedEmail);

        $user = $this->userRepository->findByEmail($normalizedEmail);
        if ($user === null) {
            return Response::error('Invalid email or password', 401);
        }

        if (!$this->authService->verifyPassword($password, $user['passwordHash'])) {
            return Response::error('Invalid email or password', 401);
        }

        $token = $this->authService->generateToken($user);

        return Response::ok([
            'user' => AuthService::formatPublicUser($user),
            'token' => $token,
        ]);
    }

    /**
     * GET /api/auth/me
     */
    public function me(Request $request): Response
    {
        $authResult = AuthMiddleware::authenticate($request, $this->userRepository);

        if ($authResult instanceof Response) {
            return $authResult;
        }

        return Response::ok([
            'user' => AuthService::formatPublicUser($authResult),
        ]);
    }
}
