<?php

declare(strict_types=1);

namespace PathFlow\Teacher;

use PathFlow\Auth\Jwt;
use PathFlow\Http\Request;
use PathFlow\Http\Response;

/**
 * Controller handling:
 * 1. Student grant management: POST, GET, DELETE /api/teacher/grants
 * 2. Teacher read-only inspection: GET /api/teacher/students/:studentId/*
 * 3. Strict rejection of mutation operations: POST, PUT, PATCH, DELETE /api/teacher/students/:studentId/*
 */
class TeacherController
{
    private TeacherService $teacherService;

    public function __construct(?TeacherService $teacherService = null)
    {
        $this->teacherService = $teacherService ?? new TeacherService();
    }

    /**
     * Authenticate that request bearer token belongs to a user with role 'student'.
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
            return Response::error('Only students can manage teacher access grants', 403);
        }

        return (string)$decoded['userId'];
    }

    /**
     * Extract teacher access token from X-Teacher-Token header or Authorization Bearer header.
     */
    private function extractTeacherToken(Request $request): ?string
    {
        $custom = $request->getHeader('x-teacher-token');
        if ($custom !== null && trim($custom) !== '') {
            return trim($custom);
        }

        return $request->getBearerToken();
    }

    // --- Student Grant Management ---

    public function createGrant(Request $request): Response
    {
        $studentId = $this->authenticateStudent($request);
        if ($studentId instanceof Response) {
            return $studentId;
        }

        $body = $request->getJson() ?? [];
        $label = trim((string)($body['label'] ?? ''));
        if ($label === '') {
            return Response::error('Grant label is required', 400);
        }

        try {
            $grant = $this->teacherService->createGrant($studentId, $body);
            return Response::created($grant);
        } catch (\Throwable $e) {
            return Response::error($e->getMessage(), 400);
        }
    }

    public function listGrants(Request $request): Response
    {
        $studentId = $this->authenticateStudent($request);
        if ($studentId instanceof Response) {
            return $studentId;
        }

        $grants = $this->teacherService->listGrants($studentId);
        return Response::ok($grants);
    }

    public function revokeGrant(Request $request): Response
    {
        $studentId = $this->authenticateStudent($request);
        if ($studentId instanceof Response) {
            return $studentId;
        }

        $grantId = (string)$request->getParam('id');
        try {
            $revoked = $this->teacherService->revokeGrant($studentId, $grantId);
            return Response::ok($revoked);
        } catch (\Throwable $e) {
            $code = $e->getCode() ?: 403;
            if ($code < 400 || $code > 599) {
                $code = 403;
            }
            return Response::error($e->getMessage(), (int)$code);
        }
    }

    // --- Teacher Read-Only Endpoints ---

    public function getGoals(Request $request): Response
    {
        $token = $this->extractTeacherToken($request);
        if (!$token) {
            return Response::error('Missing teacher access token', 401);
        }

        $studentId = (string)$request->getParam('studentId');
        try {
            $goals = $this->teacherService->getStudentGoals($token, $studentId);
            return Response::ok($goals);
        } catch (\Throwable $e) {
            $code = $e->getCode() ?: 403;
            return Response::error($e->getMessage(), (int)$code);
        }
    }

    public function getRoadmaps(Request $request): Response
    {
        $token = $this->extractTeacherToken($request);
        if (!$token) {
            return Response::error('Missing teacher access token', 401);
        }

        $studentId = (string)$request->getParam('studentId');
        try {
            $roadmaps = $this->teacherService->getStudentRoadmaps($token, $studentId);
            return Response::ok($roadmaps);
        } catch (\Throwable $e) {
            $code = $e->getCode() ?: 403;
            return Response::error($e->getMessage(), (int)$code);
        }
    }

    public function getTasks(Request $request): Response
    {
        $token = $this->extractTeacherToken($request);
        if (!$token) {
            return Response::error('Missing teacher access token', 401);
        }

        $studentId = (string)$request->getParam('studentId');
        try {
            $tasks = $this->teacherService->getStudentTasks($token, $studentId);
            return Response::ok($tasks);
        } catch (\Throwable $e) {
            $code = $e->getCode() ?: 403;
            return Response::error($e->getMessage(), (int)$code);
        }
    }

    public function getSessions(Request $request): Response
    {
        $token = $this->extractTeacherToken($request);
        if (!$token) {
            return Response::error('Missing teacher access token', 401);
        }

        $studentId = (string)$request->getParam('studentId');
        $startDate = $request->getQuery('startDate');
        $endDate = $request->getQuery('endDate');

        try {
            $sessions = $this->teacherService->getStudentSessions($token, $studentId, $startDate, $endDate);
            return Response::ok($sessions);
        } catch (\Throwable $e) {
            $code = $e->getCode() ?: 403;
            return Response::error($e->getMessage(), (int)$code);
        }
    }

    public function getWeeklyPlans(Request $request): Response
    {
        $token = $this->extractTeacherToken($request);
        if (!$token) {
            return Response::error('Missing teacher access token', 401);
        }

        $studentId = (string)$request->getParam('studentId');
        try {
            $plans = $this->teacherService->getStudentWeeklyPlans($token, $studentId);
            return Response::ok($plans);
        } catch (\Throwable $e) {
            $code = $e->getCode() ?: 403;
            return Response::error($e->getMessage(), (int)$code);
        }
    }

    public function getProgress(Request $request): Response
    {
        $token = $this->extractTeacherToken($request);
        if (!$token) {
            return Response::error('Missing teacher access token', 401);
        }

        $studentId = (string)$request->getParam('studentId');
        try {
            $progress = $this->teacherService->getStudentProgress($token, $studentId);
            return Response::ok($progress);
        } catch (\Throwable $e) {
            $code = $e->getCode() ?: 403;
            return Response::error($e->getMessage(), (int)$code);
        }
    }

    public function getReports(Request $request): Response
    {
        $token = $this->extractTeacherToken($request);
        if (!$token) {
            return Response::error('Missing teacher access token', 401);
        }

        $studentId = (string)$request->getParam('studentId');
        try {
            $reports = $this->teacherService->getStudentReports($token, $studentId);
            return Response::ok($reports);
        } catch (\Throwable $e) {
            $code = $e->getCode() ?: 403;
            return Response::error($e->getMessage(), (int)$code);
        }
    }

    // --- Strict Mutation Rejection ---

    public function rejectMutation(Request $request): Response
    {
        return Response::error('Teacher access is strictly read-only. Mutation operations are prohibited.', 403);
    }
}
