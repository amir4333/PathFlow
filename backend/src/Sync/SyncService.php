<?php

declare(strict_types=1);

namespace PathFlow\Sync;

use PathFlow\Support\Uuid;

/**
 * SyncService
 *
 * Implements server-side delta synchronization, strict idempotency enforcement,
 * and student ownership validation matching the PathFlow Sync Engine.
 */
class SyncService
{
    private SyncStore $store;

    public const SUPPORTED_ENTITIES = [
        'goal',
        'roadmap',
        'task',
        'session',
        'weeklyPlan',
        'weeklyPlanItem',
    ];

    public const SUPPORTED_OPERATIONS = [
        'create',
        'update',
        'delete',
    ];

    public function __construct(?SyncStore $store = null)
    {
        $this->store = $store ?? SyncStore::getInstance();
    }

    /**
     * Process a batch of client mutations idempotently.
     */
    public function processPush(string $studentId, array $request): array
    {
        $acceptedMutationIds = [];
        $rejectedMutations = [];

        $deviceId = (string)($request['deviceId'] ?? '');
        $mutations = $request['mutations'] ?? [];

        foreach ($mutations as $mutation) {
            $mutationId = (string)($mutation['id'] ?? Uuid::v4());
            $clientMutationId = (string)($mutation['clientMutationId'] ?? '');
            $entityType = (string)($mutation['entityType'] ?? '');
            $entityId = (string)($mutation['entityId'] ?? '');
            $operation = (string)($mutation['operation'] ?? '');
            $payload = $mutation['payload'] ?? null;
            $timestamp = (string)($mutation['timestamp'] ?? (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z'));

            if ($clientMutationId === '' || $entityId === '') {
                $rejectedMutations[] = [
                    'mutationId' => $mutationId,
                    'reason' => 'clientMutationId and entityId are required',
                ];
                continue;
            }

            if (!in_array($entityType, self::SUPPORTED_ENTITIES, true)) {
                $rejectedMutations[] = [
                    'mutationId' => $mutationId,
                    'reason' => "Unsupported entity type: {$entityType}",
                ];
                continue;
            }

            if (!in_array($operation, self::SUPPORTED_OPERATIONS, true)) {
                $rejectedMutations[] = [
                    'mutationId' => $mutationId,
                    'reason' => "Unsupported operation: {$operation}",
                ];
                continue;
            }

            try {
                // 1. Idempotency check: (studentId, deviceId, clientMutationId)
                $existing = $this->store->findMutationByClientKey($studentId, $deviceId, $clientMutationId);
                if ($existing !== null) {
                    $acceptedMutationIds[] = $mutationId;
                    continue;
                }

                // 2. Apply entity mutation
                $this->applyEntityMutation($studentId, $entityType, $entityId, $operation, $payload, $timestamp);

                // 3. Record in mutation ledger
                $this->store->recordMutation([
                    'id' => $mutationId,
                    'studentId' => $studentId,
                    'deviceId' => $deviceId,
                    'clientMutationId' => $clientMutationId,
                    'entityType' => $entityType,
                    'entityId' => $entityId,
                    'operation' => $operation,
                    'payload' => $payload,
                    'timestamp' => $timestamp,
                ]);

                $acceptedMutationIds[] = $mutationId;
            } catch (\Throwable $e) {
                $rejectedMutations[] = [
                    'mutationId' => $mutationId,
                    'reason' => $e->getMessage(),
                ];
            }
        }

        $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');

        return [
            'acceptedMutationIds' => $acceptedMutationIds,
            'rejectedMutations' => $rejectedMutations,
            'serverTimestamp' => $now,
        ];
    }

    /**
     * Process pull request to return changesets and tombstones since cursor.
     */
    public function processPull(string $studentId, array $request): array
    {
        $cursor = $request['cursor'] ?? null;
        $limit = isset($request['limit']) && is_numeric($request['limit']) ? max(1, (int)$request['limit']) : 100;

        $queryCursor = 0;
        if (isset($cursor['serverVersion']) && (int)$cursor['serverVersion'] > 0) {
            $queryCursor = (int)$cursor['serverVersion'];
        } elseif (!empty($cursor['lastSyncTimestamp'])) {
            $queryCursor = (string)$cursor['lastSyncTimestamp'];
        }

        $mutations = $this->store->getMutationsAfter($studentId, $queryCursor, $limit);
        $tombstones = $this->store->getTombstonesAfter($studentId, $queryCursor);

        $changes = [];
        foreach ($mutations as $m) {
            if ($m['operation'] === 'delete' || $m['payload'] === null) {
                continue;
            }

            $parsedPayload = [];
            if (is_array($m['payload'])) {
                $parsedPayload = $m['payload'];
            } elseif (is_string($m['payload'])) {
                $decoded = json_decode($m['payload'], true);
                $parsedPayload = is_array($decoded) ? $decoded : [];
            }

            $changes[] = [
                'entityType' => $m['entityType'],
                'entityId' => $m['entityId'],
                'payload' => $parsedPayload,
                'updatedAt' => $m['timestamp'],
            ];
        }

        $formattedTombstones = [];
        foreach ($tombstones as $t) {
            $formattedTombstones[] = [
                'entityType' => $t['entityType'],
                'entityId' => $t['entityId'],
                'deletedAt' => $t['deletedAt'],
            ];
        }

        $maxSeq = $this->store->getMaxSequence($studentId);
        $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');

        return [
            'changes' => $changes,
            'tombstones' => $formattedTombstones,
            'nextCursor' => [
                'lastSyncTimestamp' => $now,
                'serverVersion' => $maxSeq,
            ],
            'hasMore' => count($mutations) === $limit,
        ];
    }

    /**
     * Apply individual entity mutation to corresponding domain table.
     */
    private function applyEntityMutation(
        string $studentId,
        string $entityType,
        string $entityId,
        string $operation,
        mixed $payload,
        string $timestamp
    ): void {
        if ($operation === 'delete') {
            // Record tombstone
            $this->store->recordTombstone([
                'studentId' => $studentId,
                'entityType' => $entityType,
                'entityId' => $entityId,
                'deletedAt' => $timestamp,
            ]);

            // Delete from domain table
            switch ($entityType) {
                case 'goal':
                    $this->store->deleteGoal($studentId, $entityId);
                    break;
                case 'roadmap':
                    $this->store->deleteRoadmap($studentId, $entityId);
                    break;
                case 'task':
                    $this->store->deleteTask($studentId, $entityId);
                    break;
                case 'session':
                    $this->store->deleteSession($studentId, $entityId);
                    break;
                case 'weeklyPlan':
                    $this->store->deleteWeeklyPlan($studentId, $entityId);
                    break;
                case 'weeklyPlanItem':
                    $this->store->deleteWeeklyPlanItem($studentId, $entityId);
                    break;
            }
            return;
        }

        // Create or Update
        if (!is_array($payload)) {
            return;
        }

        switch ($entityType) {
            case 'goal':
                $this->store->upsertGoal([
                    'id' => $entityId,
                    'studentId' => $studentId,
                    'title' => (string)($payload['title'] ?? ''),
                    'description' => (string)($payload['description'] ?? ''),
                    'status' => (string)($payload['status'] ?? 'not_started'),
                    'createdAt' => (string)($payload['createdAt'] ?? $timestamp),
                    'updatedAt' => (string)($payload['updatedAt'] ?? $timestamp),
                ]);
                break;

            case 'roadmap':
                $this->store->upsertRoadmap([
                    'id' => $entityId,
                    'studentId' => $studentId,
                    'goalId' => (string)($payload['goalId'] ?? ''),
                    'title' => (string)($payload['title'] ?? ''),
                    'createdAt' => (string)($payload['createdAt'] ?? $timestamp),
                    'updatedAt' => (string)($payload['updatedAt'] ?? $timestamp),
                ]);
                break;

            case 'task':
                $this->store->upsertTask([
                    'id' => $entityId,
                    'studentId' => $studentId,
                    'roadmapId' => (string)($payload['roadmapId'] ?? ''),
                    'title' => (string)($payload['title'] ?? ''),
                    'description' => (string)($payload['description'] ?? ''),
                    'status' => (string)($payload['status'] ?? 'todo'),
                    'priority' => (string)($payload['priority'] ?? 'medium'),
                    'estimatedMinutes' => (int)($payload['estimatedMinutes'] ?? 0),
                    'createdAt' => (string)($payload['createdAt'] ?? $timestamp),
                    'updatedAt' => (string)($payload['updatedAt'] ?? $timestamp),
                    'completedAt' => isset($payload['completedAt']) && $payload['completedAt'] !== null ? (string)$payload['completedAt'] : null,
                ]);
                break;

            case 'session':
                $this->store->upsertSession([
                    'id' => $entityId,
                    'studentId' => $studentId,
                    'taskId' => (string)($payload['taskId'] ?? ''),
                    'startedAt' => (string)($payload['startedAt'] ?? $timestamp),
                    'endedAt' => (string)($payload['endedAt'] ?? $timestamp),
                    'durationMinutes' => (int)($payload['durationMinutes'] ?? 0),
                ]);
                break;

            case 'weeklyPlan':
                $this->store->upsertWeeklyPlan([
                    'id' => $entityId,
                    'studentId' => $studentId,
                    'weekIdentifier' => (string)($payload['weekIdentifier'] ?? ''),
                    'title' => (string)($payload['title'] ?? ''),
                    'targetMinutes' => (int)($payload['targetMinutes'] ?? 0),
                    'createdAt' => (string)($payload['createdAt'] ?? $timestamp),
                    'updatedAt' => (string)($payload['updatedAt'] ?? $timestamp),
                ]);
                break;

            case 'weeklyPlanItem':
                $this->store->upsertWeeklyPlanItem([
                    'id' => $entityId,
                    'studentId' => $studentId,
                    'weeklyPlanId' => (string)($payload['weeklyPlanId'] ?? ''),
                    'taskId' => (string)($payload['taskId'] ?? ''),
                    'targetDate' => isset($payload['targetDate']) && $payload['targetDate'] !== null ? (string)$payload['targetDate'] : null,
                    'plannedMinutes' => (int)($payload['plannedMinutes'] ?? 0),
                    'isCompleted' => !empty($payload['isCompleted']),
                ]);
                break;
        }
    }
}
