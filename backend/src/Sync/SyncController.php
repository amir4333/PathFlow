<?php

declare(strict_types=1);

namespace PathFlow\Sync;

use PathFlow\Auth\Jwt;
use PathFlow\Http\Request;
use PathFlow\Http\Response;

/**
 * Controller handling synchronization requests:
 * POST /api/sync/push
 * POST /api/sync/pull
 * GET  /api/sync/status
 */
class SyncController
{
    private SyncService $syncService;

    public function __construct(?SyncService $syncService = null)
    {
        $this->syncService = $syncService ?? new SyncService();
    }

    /**
     * Authenticate that request bearer token belongs to a user with role 'student'.
     * Returns studentId string or Response on error.
     */
    private function authenticateStudent(Request $request): string|Response
    {
        $token = $request->getBearerToken();
        if ($token === null || $token === '') {
            return Response::error('Missing or invalid Authorization header', 401);
        }

        $decoded = Jwt::decode($token);
        if ($decoded === null || empty($decoded['userId'])) {
            return Response::error('Invalid or expired token', 401);
        }

        if (($decoded['role'] ?? '') !== 'student') {
            return Response::error('Only student accounts can synchronize personal workspace data', 403);
        }

        return (string)$decoded['userId'];
    }

    /**
     * POST /api/sync/push
     */
    public function push(Request $request): Response
    {
        $studentId = $this->authenticateStudent($request);
        if ($studentId instanceof Response) {
            return $studentId;
        }

        $body = $request->getJson();
        if (!$body || empty($body['deviceId']) || !isset($body['mutations']) || !is_array($body['mutations'])) {
            return Response::error('Invalid push request. Must contain deviceId and mutations array.', 400);
        }

        $result = $this->syncService->processPush($studentId, $body);
        return Response::ok($result);
    }

    /**
     * POST /api/sync/pull
     */
    public function pull(Request $request): Response
    {
        $studentId = $this->authenticateStudent($request);
        if ($studentId instanceof Response) {
            return $studentId;
        }

        $body = $request->getJson() ?? ['cursor' => null];
        if (!is_array($body)) {
            $body = ['cursor' => null];
        }

        $result = $this->syncService->processPull($studentId, $body);
        return Response::ok($result);
    }

    /**
     * GET /api/sync/status
     */
    public function status(Request $request): Response
    {
        $studentId = $this->authenticateStudent($request);
        if ($studentId instanceof Response) {
            return $studentId;
        }

        $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');

        return Response::ok([
            'state' => 'idle',
            'isOnline' => true,
            'studentId' => $studentId,
            'serverTime' => $now,
        ]);
    }
}
