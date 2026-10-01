<?php

declare(strict_types=1);

namespace PathFlow\Sync;

use PDO;
use PathFlow\Database\Database;
use PathFlow\Support\Uuid;

/**
 * Data store repository for delta synchronization and domain entity persistence.
 * Supports native MySQL PDO prepared statements and in-memory test store.
 */
class SyncStore
{
    private static ?self $instance = null;
    private bool $useMemory;

    // In-memory collections for unit testing without live MySQL
    private array $mutations = [];
    private array $tombstones = [];
    private array $goals = [];
    private array $roadmaps = [];
    private array $tasks = [];
    private array $sessions = [];
    private array $weeklyPlans = [];
    private array $weeklyPlanItems = [];
    private int $mutationSeqCounter = 0;
    private int $tombstoneSeqCounter = 0;

    public function __construct(bool $useMemory = false)
    {
        $this->useMemory = $useMemory;
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public static function setInstance(?self $instance): void
    {
        self::$instance = $instance;
    }

    public function clearMemory(): void
    {
        $this->mutations = [];
        $this->tombstones = [];
        $this->goals = [];
        $this->roadmaps = [];
        $this->tasks = [];
        $this->sessions = [];
        $this->weeklyPlans = [];
        $this->weeklyPlanItems = [];
        $this->mutationSeqCounter = 0;
        $this->tombstoneSeqCounter = 0;
    }

    // --- Idempotency & Mutation Audit Log ---

    public function findMutationByClientKey(string $studentId, string $deviceId, string $clientMutationId): ?array
    {
        if ($this->useMemory) {
            foreach ($this->mutations as $m) {
                if (
                    $m['studentId'] === $studentId &&
                    $m['deviceId'] === $deviceId &&
                    $m['clientMutationId'] === $clientMutationId
                ) {
                    return $m;
                }
            }
            return null;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'SELECT * FROM ' . Database::table('SyncMutationRecord') . ' WHERE studentId = :studentId AND deviceId = :deviceId AND clientMutationId = :clientMutationId LIMIT 1'
        );
        $stmt->execute([
            'studentId' => $studentId,
            'deviceId' => $deviceId,
            'clientMutationId' => $clientMutationId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function recordMutation(array $data): array
    {
        $id = $data['id'] ?? Uuid::v4();
        $studentId = $data['studentId'];
        $deviceId = $data['deviceId'];
        $clientMutationId = $data['clientMutationId'];
        $entityType = $data['entityType'];
        $entityId = $data['entityId'];
        $operation = $data['operation'];
        $payload = is_string($data['payload']) ? $data['payload'] : ($data['payload'] !== null ? json_encode($data['payload']) : null);
        $timestamp = $data['timestamp'];

        if ($this->useMemory) {
            $this->mutationSeqCounter++;
            $record = [
                'id' => $id,
                'studentId' => $studentId,
                'deviceId' => $deviceId,
                'clientMutationId' => $clientMutationId,
                'sequence' => $this->mutationSeqCounter,
                'entityType' => $entityType,
                'entityId' => $entityId,
                'operation' => $operation,
                'payload' => $payload,
                'timestamp' => $timestamp,
            ];
            $this->mutations[] = $record;
            return $record;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . Database::table('SyncMutationRecord') . ' (id, studentId, deviceId, clientMutationId, entityType, entityId, operation, payload, timestamp)
             VALUES (:id, :studentId, :deviceId, :clientMutationId, :entityType, :entityId, :operation, :payload, :timestamp)'
        );
        $stmt->execute([
            'id' => $id,
            'studentId' => $studentId,
            'deviceId' => $deviceId,
            'clientMutationId' => $clientMutationId,
            'entityType' => $entityType,
            'entityId' => $entityId,
            'operation' => $operation,
            'payload' => $payload,
            'timestamp' => $timestamp,
        ]);

        $seq = (int)$pdo->lastInsertId();
        return array_merge($data, ['id' => $id, 'sequence' => $seq]);
    }

    public function getMutationsAfter(string $studentId, int|string $queryCursor, int $limit): array
    {
        if ($this->useMemory) {
            $results = [];
            foreach ($this->mutations as $m) {
                if ($m['studentId'] !== $studentId) {
                    continue;
                }
                if (is_int($queryCursor) || is_numeric($queryCursor)) {
                    if ((int)$m['sequence'] > (int)$queryCursor) {
                        $results[] = $m;
                    }
                } else {
                    if ($m['timestamp'] > $queryCursor) {
                        $results[] = $m;
                    }
                }
            }
            usort($results, fn($a, $b) => (int)$a['sequence'] <=> (int)$b['sequence']);
            return array_slice($results, 0, $limit);
        }

        $pdo = Database::getConnection();
        if (is_int($queryCursor) || is_numeric($queryCursor)) {
            $stmt = $pdo->prepare(
                'SELECT * FROM ' . Database::table('SyncMutationRecord') . ' WHERE studentId = :studentId AND sequence > :cursor ORDER BY sequence ASC LIMIT :limit'
            );
            $stmt->bindValue(':studentId', $studentId, PDO::PARAM_STR);
            $stmt->bindValue(':cursor', (int)$queryCursor, PDO::PARAM_INT);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        } else {
            $stmt = $pdo->prepare(
                'SELECT * FROM ' . Database::table('SyncMutationRecord') . ' WHERE studentId = :studentId AND timestamp > :cursor ORDER BY sequence ASC LIMIT :limit'
            );
            $stmt->bindValue(':studentId', $studentId, PDO::PARAM_STR);
            $stmt->bindValue(':cursor', $queryCursor, PDO::PARAM_STR);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        }
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getMaxSequence(string $studentId): int
    {
        if ($this->useMemory) {
            $max = 0;
            foreach ($this->mutations as $m) {
                if ($m['studentId'] === $studentId && (int)$m['sequence'] > $max) {
                    $max = (int)$m['sequence'];
                }
            }
            return $max;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT MAX(sequence) as maxSeq FROM ' . Database::table('SyncMutationRecord') . ' WHERE studentId = :studentId');
        $stmt->execute(['studentId' => $studentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return isset($row['maxSeq']) && $row['maxSeq'] !== null ? (int)$row['maxSeq'] : 0;
    }

    // --- Tombstone Ledger ---

    public function recordTombstone(array $data): array
    {
        $id = $data['id'] ?? Uuid::v4();
        $studentId = $data['studentId'];
        $entityType = $data['entityType'];
        $entityId = $data['entityId'];
        $deletedAt = $data['deletedAt'];

        if ($this->useMemory) {
            // Check if tombstone already exists for (studentId, entityType, entityId)
            foreach ($this->tombstones as &$t) {
                if ($t['studentId'] === $studentId && $t['entityType'] === $entityType && $t['entityId'] === $entityId) {
                    $t['deletedAt'] = $deletedAt;
                    return $t;
                }
            }
            $this->tombstoneSeqCounter++;
            $tombstone = [
                'id' => $id,
                'studentId' => $studentId,
                'entityType' => $entityType,
                'entityId' => $entityId,
                'deletedAt' => $deletedAt,
                'sequence' => $this->tombstoneSeqCounter,
            ];
            $this->tombstones[] = $tombstone;
            return $tombstone;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . Database::table('Tombstone') . ' (id, studentId, entityType, entityId, deletedAt)
             VALUES (:id, :studentId, :entityType, :entityId, :deletedAt)
             ON DUPLICATE KEY UPDATE deletedAt = VALUES(deletedAt)'
        );
        $stmt->execute([
            'id' => $id,
            'studentId' => $studentId,
            'entityType' => $entityType,
            'entityId' => $entityId,
            'deletedAt' => $deletedAt,
        ]);

        return array_merge($data, ['id' => $id]);
    }

    public function getTombstonesAfter(string $studentId, int|string $queryCursor): array
    {
        if ($this->useMemory) {
            $results = [];
            foreach ($this->tombstones as $t) {
                if ($t['studentId'] !== $studentId) {
                    continue;
                }
                if (is_int($queryCursor) || is_numeric($queryCursor)) {
                    if ((int)$t['sequence'] > (int)$queryCursor) {
                        $results[] = $t;
                    }
                } else {
                    if ($t['deletedAt'] > $queryCursor) {
                        $results[] = $t;
                    }
                }
            }
            return $results;
        }

        $pdo = Database::getConnection();
        if (is_int($queryCursor) || is_numeric($queryCursor)) {
            $stmt = $pdo->prepare(
                'SELECT entityType, entityId, deletedAt FROM ' . Database::table('Tombstone') . ' WHERE studentId = :studentId AND sequence > :cursor ORDER BY sequence ASC'
            );
            $stmt->bindValue(':studentId', $studentId, PDO::PARAM_STR);
            $stmt->bindValue(':cursor', (int)$queryCursor, PDO::PARAM_INT);
        } else {
            $stmt = $pdo->prepare(
                'SELECT entityType, entityId, deletedAt FROM ' . Database::table('Tombstone') . ' WHERE studentId = :studentId AND deletedAt > :cursor ORDER BY sequence ASC'
            );
            $stmt->bindValue(':studentId', $studentId, PDO::PARAM_STR);
            $stmt->bindValue(':cursor', $queryCursor, PDO::PARAM_STR);
        }
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // --- Domain Entity Operations ---

    public function upsertGoal(array $data): void
    {
        if ($this->useMemory) {
            $this->goals[$data['id']] = $data;
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . Database::table('Goal') . ' (id, studentId, title, description, status, createdAt, updatedAt)
             VALUES (:id, :studentId, :title, :description, :status, :createdAt, :updatedAt)
             ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), status = VALUES(status), updatedAt = VALUES(updatedAt)'
        );
        $stmt->execute([
            'id' => $data['id'],
            'studentId' => $data['studentId'],
            'title' => $data['title'],
            'description' => $data['description'],
            'status' => $data['status'],
            'createdAt' => $data['createdAt'],
            'updatedAt' => $data['updatedAt'],
        ]);
    }

    public function deleteGoal(string $studentId, string $id): void
    {
        if ($this->useMemory) {
            if (isset($this->goals[$id]) && $this->goals[$id]['studentId'] === $studentId) {
                unset($this->goals[$id]);
            }
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('DELETE FROM ' . Database::table('Goal') . ' WHERE id = :id AND studentId = :studentId');
        $stmt->execute(['id' => $id, 'studentId' => $studentId]);
    }

    public function getGoals(string $studentId): array
    {
        if ($this->useMemory) {
            $res = [];
            foreach ($this->goals as $g) {
                if ($g['studentId'] === $studentId) {
                    $res[] = $g;
                }
            }
            return array_values($res);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM ' . Database::table('Goal') . ' WHERE studentId = :studentId ORDER BY createdAt ASC');
        $stmt->execute(['studentId' => $studentId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function upsertRoadmap(array $data): void
    {
        if ($this->useMemory) {
            $this->roadmaps[$data['id']] = $data;
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . Database::table('Roadmap') . ' (id, studentId, goalId, title, createdAt, updatedAt)
             VALUES (:id, :studentId, :goalId, :title, :createdAt, :updatedAt)
             ON DUPLICATE KEY UPDATE goalId = VALUES(goalId), title = VALUES(title), updatedAt = VALUES(updatedAt)'
        );
        $stmt->execute([
            'id' => $data['id'],
            'studentId' => $data['studentId'],
            'goalId' => $data['goalId'],
            'title' => $data['title'],
            'createdAt' => $data['createdAt'],
            'updatedAt' => $data['updatedAt'],
        ]);
    }

    public function deleteRoadmap(string $studentId, string $id): void
    {
        if ($this->useMemory) {
            if (isset($this->roadmaps[$id]) && $this->roadmaps[$id]['studentId'] === $studentId) {
                unset($this->roadmaps[$id]);
            }
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('DELETE FROM ' . Database::table('Roadmap') . ' WHERE id = :id AND studentId = :studentId');
        $stmt->execute(['id' => $id, 'studentId' => $studentId]);
    }

    public function getRoadmaps(string $studentId): array
    {
        if ($this->useMemory) {
            $res = [];
            foreach ($this->roadmaps as $r) {
                if ($r['studentId'] === $studentId) {
                    $res[] = $r;
                }
            }
            return array_values($res);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM ' . Database::table('Roadmap') . ' WHERE studentId = :studentId ORDER BY createdAt ASC');
        $stmt->execute(['studentId' => $studentId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function upsertTask(array $data): void
    {
        if ($this->useMemory) {
            $this->tasks[$data['id']] = $data;
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . Database::table('Task') . ' (id, studentId, roadmapId, title, description, status, priority, estimatedMinutes, createdAt, updatedAt, completedAt)
             VALUES (:id, :studentId, :roadmapId, :title, :description, :status, :priority, :estimatedMinutes, :createdAt, :updatedAt, :completedAt)
             ON DUPLICATE KEY UPDATE roadmapId = VALUES(roadmapId), title = VALUES(title), description = VALUES(description),
             status = VALUES(status), priority = VALUES(priority), estimatedMinutes = VALUES(estimatedMinutes),
             updatedAt = VALUES(updatedAt), completedAt = VALUES(completedAt)'
        );
        $stmt->execute([
            'id' => $data['id'],
            'studentId' => $data['studentId'],
            'roadmapId' => $data['roadmapId'],
            'title' => $data['title'],
            'description' => $data['description'],
            'status' => $data['status'],
            'priority' => $data['priority'],
            'estimatedMinutes' => (int)$data['estimatedMinutes'],
            'createdAt' => $data['createdAt'],
            'updatedAt' => $data['updatedAt'],
            'completedAt' => $data['completedAt'],
        ]);
    }

    public function deleteTask(string $studentId, string $id): void
    {
        if ($this->useMemory) {
            if (isset($this->tasks[$id]) && $this->tasks[$id]['studentId'] === $studentId) {
                unset($this->tasks[$id]);
            }
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('DELETE FROM ' . Database::table('Task') . ' WHERE id = :id AND studentId = :studentId');
        $stmt->execute(['id' => $id, 'studentId' => $studentId]);
    }

    public function getTasks(string $studentId): array
    {
        if ($this->useMemory) {
            $res = [];
            foreach ($this->tasks as $t) {
                if ($t['studentId'] === $studentId) {
                    $res[] = $t;
                }
            }
            return array_values($res);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM ' . Database::table('Task') . ' WHERE studentId = :studentId ORDER BY createdAt ASC');
        $stmt->execute(['studentId' => $studentId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function upsertSession(array $data): void
    {
        if ($this->useMemory) {
            $this->sessions[$data['id']] = $data;
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . Database::table('Session') . ' (id, studentId, taskId, startedAt, endedAt, durationMinutes)
             VALUES (:id, :studentId, :taskId, :startedAt, :endedAt, :durationMinutes)
             ON DUPLICATE KEY UPDATE taskId = VALUES(taskId), startedAt = VALUES(startedAt), endedAt = VALUES(endedAt), durationMinutes = VALUES(durationMinutes)'
        );
        $stmt->execute([
            'id' => $data['id'],
            'studentId' => $data['studentId'],
            'taskId' => $data['taskId'],
            'startedAt' => $data['startedAt'],
            'endedAt' => $data['endedAt'],
            'durationMinutes' => (int)$data['durationMinutes'],
        ]);
    }

    public function deleteSession(string $studentId, string $id): void
    {
        if ($this->useMemory) {
            if (isset($this->sessions[$id]) && $this->sessions[$id]['studentId'] === $studentId) {
                unset($this->sessions[$id]);
            }
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('DELETE FROM ' . Database::table('Session') . ' WHERE id = :id AND studentId = :studentId');
        $stmt->execute(['id' => $id, 'studentId' => $studentId]);
    }

    public function getSessions(string $studentId): array
    {
        if ($this->useMemory) {
            $res = [];
            foreach ($this->sessions as $s) {
                if ($s['studentId'] === $studentId) {
                    $res[] = $s;
                }
            }
            return array_values($res);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM ' . Database::table('Session') . ' WHERE studentId = :studentId ORDER BY startedAt ASC');
        $stmt->execute(['studentId' => $studentId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function upsertWeeklyPlan(array $data): void
    {
        if ($this->useMemory) {
            $this->weeklyPlans[$data['id']] = $data;
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . Database::table('WeeklyPlan') . ' (id, studentId, weekIdentifier, title, targetMinutes, createdAt, updatedAt)
             VALUES (:id, :studentId, :weekIdentifier, :title, :targetMinutes, :createdAt, :updatedAt)
             ON DUPLICATE KEY UPDATE weekIdentifier = VALUES(weekIdentifier), title = VALUES(title), targetMinutes = VALUES(targetMinutes), updatedAt = VALUES(updatedAt)'
        );
        $stmt->execute([
            'id' => $data['id'],
            'studentId' => $data['studentId'],
            'weekIdentifier' => $data['weekIdentifier'],
            'title' => $data['title'],
            'targetMinutes' => (int)$data['targetMinutes'],
            'createdAt' => $data['createdAt'],
            'updatedAt' => $data['updatedAt'],
        ]);
    }

    public function deleteWeeklyPlan(string $studentId, string $id): void
    {
        if ($this->useMemory) {
            if (isset($this->weeklyPlans[$id]) && $this->weeklyPlans[$id]['studentId'] === $studentId) {
                unset($this->weeklyPlans[$id]);
            }
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('DELETE FROM ' . Database::table('WeeklyPlan') . ' WHERE id = :id AND studentId = :studentId');
        $stmt->execute(['id' => $id, 'studentId' => $studentId]);
    }

    public function getWeeklyPlans(string $studentId): array
    {
        if ($this->useMemory) {
            $res = [];
            foreach ($this->weeklyPlans as $wp) {
                if ($wp['studentId'] === $studentId) {
                    $res[] = $wp;
                }
            }
            return array_values($res);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM ' . Database::table('WeeklyPlan') . ' WHERE studentId = :studentId ORDER BY createdAt ASC');
        $stmt->execute(['studentId' => $studentId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function upsertWeeklyPlanItem(array $data): void
    {
        if ($this->useMemory) {
            $this->weeklyPlanItems[$data['id']] = $data;
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . Database::table('WeeklyPlanItem') . ' (id, studentId, weeklyPlanId, taskId, targetDate, plannedMinutes, isCompleted)
             VALUES (:id, :studentId, :weeklyPlanId, :taskId, :targetDate, :plannedMinutes, :isCompleted)
             ON DUPLICATE KEY UPDATE weeklyPlanId = VALUES(weeklyPlanId), taskId = VALUES(taskId),
             targetDate = VALUES(targetDate), plannedMinutes = VALUES(plannedMinutes), isCompleted = VALUES(isCompleted)'
        );
        $stmt->execute([
            'id' => $data['id'],
            'studentId' => $data['studentId'],
            'weeklyPlanId' => $data['weeklyPlanId'],
            'taskId' => $data['taskId'],
            'targetDate' => $data['targetDate'] ?? null,
            'plannedMinutes' => (int)$data['plannedMinutes'],
            'isCompleted' => !empty($data['isCompleted']) ? 1 : 0,
        ]);
    }

    public function deleteWeeklyPlanItem(string $studentId, string $id): void
    {
        if ($this->useMemory) {
            if (isset($this->weeklyPlanItems[$id]) && $this->weeklyPlanItems[$id]['studentId'] === $studentId) {
                unset($this->weeklyPlanItems[$id]);
            }
            return;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('DELETE FROM ' . Database::table('WeeklyPlanItem') . ' WHERE id = :id AND studentId = :studentId');
        $stmt->execute(['id' => $id, 'studentId' => $studentId]);
    }

    public function getWeeklyPlanItems(string $studentId): array
    {
        if ($this->useMemory) {
            $res = [];
            foreach ($this->weeklyPlanItems as $item) {
                if ($item['studentId'] === $studentId) {
                    $res[] = $item;
                }
            }
            return array_values($res);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM ' . Database::table('WeeklyPlanItem') . ' WHERE studentId = :studentId');
        $stmt->execute(['studentId' => $studentId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
