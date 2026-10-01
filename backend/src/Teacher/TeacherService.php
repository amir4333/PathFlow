<?php

declare(strict_types=1);

namespace PathFlow\Teacher;

use PathFlow\Sync\SyncStore;

/**
 * TeacherService
 *
 * Enforces student-controlled grants and read-only data access for teachers/mentors.
 * Completely prohibits write operations on student records.
 */
class TeacherService
{
    private TeacherStore $store;
    private SyncStore $syncStore;

    public const DEFAULT_PERMISSIONS = [
        'read:goals',
        'read:roadmaps',
        'read:tasks',
        'read:sessions',
        'read:weekly_plans',
        'read:reports',
    ];

    public function __construct(?TeacherStore $store = null, ?SyncStore $syncStore = null)
    {
        $this->store = $store ?? TeacherStore::getInstance();
        $this->syncStore = $syncStore ?? $this->store->getSyncStore();
    }

    /**
     * Create student-issued teacher access grant.
     */
    public function createGrant(string $studentId, array $options): array
    {
        $label = trim((string)($options['label'] ?? ''));
        if ($label === '') {
            throw new \InvalidArgumentException('Grant label is required');
        }

        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $expiresAt = null;
        $ttlDays = isset($options['ttlDays']) && is_numeric($options['ttlDays']) ? (int)$options['ttlDays'] : null;

        if ($ttlDays !== null && $ttlDays > 0) {
            $expiresAt = $now->modify("+{$ttlDays} days")->format('Y-m-d\TH:i:s.v\Z');
        }

        $permissions = !empty($options['permissions']) && is_array($options['permissions'])
            ? $options['permissions']
            : self::DEFAULT_PERMISSIONS;

        // High entropy cryptographically secure token with 'pt_' prefix
        $token = 'pt_' . bin2hex(random_bytes(24));

        return $this->store->createGrant([
            'studentId' => $studentId,
            'label' => $label,
            'token' => $token,
            'role' => 'read_only',
            'permissions' => $permissions,
            'createdAt' => $now->format('Y-m-d\TH:i:s.v\Z'),
            'expiresAt' => $expiresAt,
            'isActive' => true,
        ]);
    }

    /**
     * List all grants created by the student.
     */
    public function listGrants(string $studentId): array
    {
        return $this->store->getGrantsForStudent($studentId);
    }

    /**
     * Soft-revoke grant owned by the student.
     */
    public function revokeGrant(string $studentId, string $grantId): array
    {
        $grant = $this->store->getGrantById($grantId);
        if ($grant === null) {
            throw new \RuntimeException('Grant not found', 404);
        }

        if ($grant['studentId'] !== $studentId) {
            throw new \RuntimeException('Grant not owned by student', 403);
        }

        $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
        $revoked = $this->store->revokeGrant($grantId, $now);

        return $revoked ?? $grant;
    }

    /**
     * Verify teacher access token against requested student and required permission.
     */
    public function verifyAccess(string $token, string $studentId, string $requiredPermission): array
    {
        $token = trim($token);
        if ($token === '') {
            throw new \RuntimeException('Missing teacher access token', 401);
        }

        $grant = $this->store->getGrantByToken($token);
        if ($grant === null) {
            throw new \RuntimeException('Invalid or unknown teacher access token', 403);
        }

        if ($grant['studentId'] !== $studentId) {
            throw new \RuntimeException('Access token is not authorized for this student', 403);
        }

        if (empty($grant['isActive'])) {
            throw new \RuntimeException('Teacher access grant has been revoked by the student', 403);
        }

        if (!empty($grant['expiresAt'])) {
            $expTime = strtotime($grant['expiresAt']);
            if ($expTime !== false && time() > $expTime) {
                throw new \RuntimeException('Teacher access grant has expired', 403);
            }
        }

        if (!in_array($requiredPermission, $grant['permissions'] ?? [], true)) {
            throw new \RuntimeException("Teacher grant is missing required permission: \"{$requiredPermission}\"", 403);
        }

        return $grant;
    }

    public function getStudentGoals(string $token, string $studentId): array
    {
        $this->verifyAccess($token, $studentId, 'read:goals');
        return $this->syncStore->getGoals($studentId);
    }

    public function getStudentRoadmaps(string $token, string $studentId): array
    {
        $this->verifyAccess($token, $studentId, 'read:roadmaps');
        return $this->syncStore->getRoadmaps($studentId);
    }

    public function getStudentTasks(string $token, string $studentId): array
    {
        $this->verifyAccess($token, $studentId, 'read:tasks');
        return $this->syncStore->getTasks($studentId);
    }

    public function getStudentSessions(string $token, string $studentId, ?string $startDate = null, ?string $endDate = null): array
    {
        $this->verifyAccess($token, $studentId, 'read:sessions');
        $sessions = $this->syncStore->getSessions($studentId);

        if ($startDate === null && $endDate === null) {
            return $sessions;
        }

        return array_values(array_filter($sessions, function ($s) use ($startDate, $endDate) {
            if ($startDate !== null && $s['startedAt'] < $startDate) {
                return false;
            }
            if ($endDate !== null && $s['startedAt'] > $endDate) {
                return false;
            }
            return true;
        }));
    }

    public function getStudentWeeklyPlans(string $token, string $studentId): array
    {
        $this->verifyAccess($token, $studentId, 'read:weekly_plans');
        $plans = $this->syncStore->getWeeklyPlans($studentId);
        $items = $this->syncStore->getWeeklyPlanItems($studentId);

        return array_map(function ($plan) use ($items) {
            $planItems = array_values(array_filter($items, fn($i) => $i['weeklyPlanId'] === $plan['id']));
            $plan['items'] = $planItems;
            return $plan;
        }, $plans);
    }

    public function getStudentProgress(string $token, string $studentId): array
    {
        // Permission check: read:goals OR read:reports
        try {
            $this->verifyAccess($token, $studentId, 'read:goals');
        } catch (\Throwable $e) {
            $this->verifyAccess($token, $studentId, 'read:reports');
        }

        $goals = $this->syncStore->getGoals($studentId);
        $roadmaps = $this->syncStore->getRoadmaps($studentId);
        $tasks = $this->syncStore->getTasks($studentId);
        $sessions = $this->syncStore->getSessions($studentId);
        $weeklyPlans = $this->syncStore->getWeeklyPlans($studentId);

        $totalEstimatedMinutes = 0;
        $completedTasks = 0;
        foreach ($tasks as $t) {
            $totalEstimatedMinutes += (int)($t['estimatedMinutes'] ?? 0);
            if (($t['status'] ?? '') === 'completed') {
                $completedTasks++;
            }
        }

        $totalActualMinutes = 0;
        foreach ($sessions as $s) {
            $totalActualMinutes += (int)($s['durationMinutes'] ?? 0);
        }

        return [
            'studentId' => $studentId,
            'totalGoals' => count($goals),
            'totalRoadmaps' => count($roadmaps),
            'totalTasks' => count($tasks),
            'completedTasks' => $completedTasks,
            'totalSessions' => count($sessions),
            'totalEstimatedMinutes' => $totalEstimatedMinutes,
            'totalActualMinutes' => $totalActualMinutes,
            'totalWeeklyPlans' => count($weeklyPlans),
        ];
    }

    public function getStudentReports(string $token, string $studentId): array
    {
        $this->verifyAccess($token, $studentId, 'read:reports');

        $goals = $this->syncStore->getGoals($studentId);
        $roadmaps = $this->syncStore->getRoadmaps($studentId);
        $tasks = $this->syncStore->getTasks($studentId);
        $sessions = $this->syncStore->getSessions($studentId);
        $weeklyPlans = $this->getStudentWeeklyPlans($token, $studentId);

        $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');

        return [
            'studentId' => $studentId,
            'generatedAt' => $now,
            'overview' => [
                'totalGoals' => count($goals),
                'totalRoadmaps' => count($roadmaps),
                'totalTasks' => count($tasks),
                'totalSessions' => count($sessions),
                'totalWeeklyPlans' => count($weeklyPlans),
            ],
            'goals' => $goals,
            'roadmaps' => $roadmaps,
            'tasks' => $tasks,
            'sessions' => $sessions,
            'weeklyPlans' => $weeklyPlans,
        ];
    }
}
