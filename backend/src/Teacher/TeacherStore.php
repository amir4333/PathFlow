<?php

declare(strict_types=1);

namespace PathFlow\Teacher;

use PDO;
use PathFlow\Database\Database;
use PathFlow\Sync\SyncStore;
use PathFlow\Support\Uuid;

/**
 * Data store for TeacherAccessGrant and read-only access to student domain data.
 * Supports native MySQL PDO prepared statements and in-memory test store.
 */
class TeacherStore
{
    private static ?self $instance = null;
    private bool $useMemory;
    private SyncStore $syncStore;

    // In-memory grants store for unit testing
    private array $grants = [];

    public function __construct(bool $useMemory = false, ?SyncStore $syncStore = null)
    {
        $this->useMemory = $useMemory;
        $this->syncStore = $syncStore ?? SyncStore::getInstance();
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
        $this->grants = [];
    }

    public function getSyncStore(): SyncStore
    {
        return $this->syncStore;
    }

    // --- TeacherAccessGrant Operations ---

    public function createGrant(array $data): array
    {
        $id = $data['id'] ?? Uuid::v4();
        $studentId = $data['studentId'];
        $teacherId = $data['teacherId'] ?? null;
        $label = $data['label'];
        $token = $data['token'];
        $role = $data['role'] ?? 'read_only';
        $permissions = is_array($data['permissions']) ? $data['permissions'] : (json_decode($data['permissions'], true) ?? []);
        $createdAt = $data['createdAt'];
        $expiresAt = $data['expiresAt'] ?? null;
        $revokedAt = $data['revokedAt'] ?? null;
        $isActive = !empty($data['isActive']);

        $grant = [
            'id' => $id,
            'studentId' => $studentId,
            'teacherId' => $teacherId,
            'label' => $label,
            'token' => $token,
            'role' => $role,
            'permissions' => $permissions,
            'createdAt' => $createdAt,
            'expiresAt' => $expiresAt,
            'revokedAt' => $revokedAt,
            'isActive' => $isActive,
        ];

        if ($this->useMemory) {
            $this->grants[$id] = $grant;
            return $grant;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO ' . Database::table('TeacherAccessGrant') . ' (id, studentId, teacherId, label, token, role, permissions, createdAt, expiresAt, revokedAt, isActive)
             VALUES (:id, :studentId, :teacherId, :label, :token, :role, :permissions, :createdAt, :expiresAt, :revokedAt, :isActive)'
        );
        $stmt->execute([
            'id' => $id,
            'studentId' => $studentId,
            'teacherId' => $teacherId,
            'label' => $label,
            'token' => $token,
            'role' => $role,
            'permissions' => json_encode($permissions),
            'createdAt' => $createdAt,
            'expiresAt' => $expiresAt,
            'revokedAt' => $revokedAt,
            'isActive' => $isActive ? 1 : 0,
        ]);

        return $grant;
    }

    public function getGrantsForStudent(string $studentId): array
    {
        if ($this->useMemory) {
            $results = [];
            foreach ($this->grants as $g) {
                if ($g['studentId'] === $studentId) {
                    $results[] = $g;
                }
            }
            return array_values($results);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'SELECT * FROM ' . Database::table('TeacherAccessGrant') . ' WHERE studentId = :studentId ORDER BY createdAt DESC'
        );
        $stmt->execute(['studentId' => $studentId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            $row['permissions'] = json_decode($row['permissions'] ?? '[]', true) ?? [];
            $row['isActive'] = (bool)$row['isActive'];
            return $row;
        }, $rows);
    }

    public function getGrantById(string $grantId): ?array
    {
        if ($this->useMemory) {
            return $this->grants[$grantId] ?? null;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'SELECT * FROM ' . Database::table('TeacherAccessGrant') . ' WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $grantId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        $row['permissions'] = json_decode($row['permissions'] ?? '[]', true) ?? [];
        $row['isActive'] = (bool)$row['isActive'];
        return $row;
    }

    public function getGrantByToken(string $token): ?array
    {
        if ($this->useMemory) {
            foreach ($this->grants as $g) {
                if (hash_equals($g['token'], $token)) {
                    return $g;
                }
            }
            return null;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'SELECT * FROM ' . Database::table('TeacherAccessGrant') . ' WHERE token = :token LIMIT 1'
        );
        $stmt->execute(['token' => $token]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        $row['permissions'] = json_decode($row['permissions'] ?? '[]', true) ?? [];
        $row['isActive'] = (bool)$row['isActive'];
        return $row;
    }

    public function revokeGrant(string $grantId, string $revokedAt): ?array
    {
        if ($this->useMemory) {
            if (!isset($this->grants[$grantId])) {
                return null;
            }
            $this->grants[$grantId]['isActive'] = false;
            $this->grants[$grantId]['revokedAt'] = $revokedAt;
            return $this->grants[$grantId];
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'UPDATE ' . Database::table('TeacherAccessGrant') . ' SET isActive = 0, revokedAt = :revokedAt WHERE id = :id'
        );
        $stmt->execute(['revokedAt' => $revokedAt, 'id' => $grantId]);

        return $this->getGrantById($grantId);
    }
}
