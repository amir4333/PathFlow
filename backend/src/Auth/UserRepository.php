<?php

declare(strict_types=1);

namespace PathFlow\Auth;

use PDO;
use PathFlow\Database\Database;

/**
 * Data access repository for User accounts.
 * Executes native prepared statements against the 'User' table.
 * Supports test-double store injection for testing without live MySQL.
 */
class UserRepository
{
    private static ?self $instance = null;
    private ?array $memoryStore = null;
    private bool $useMemory = false;

    public function __construct(bool $useMemory = false)
    {
        $this->useMemory = $useMemory;
        if ($useMemory) {
            $this->memoryStore = [];
        }
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

    /**
     * Find user record by email (case-insensitive normalized).
     */
    public function findByEmail(string $email): ?array
    {
        $normalizedEmail = trim(strtolower($email));

        if ($this->useMemory) {
            foreach ($this->memoryStore ?? [] as $user) {
                if (strtolower($user['email']) === $normalizedEmail) {
                    return $user;
                }
            }
            return null;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT id, email, passwordHash, role, createdAt, updatedAt FROM `User` WHERE LOWER(email) = LOWER(:email) LIMIT 1');
        $stmt->execute(['email' => $normalizedEmail]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Find user record by UUID id.
     */
    public function findById(string $id): ?array
    {
        if ($this->useMemory) {
            return $this->memoryStore[$id] ?? null;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT id, email, passwordHash, role, createdAt, updatedAt FROM `User` WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Insert a new user record.
     */
    public function create(string $id, string $email, string $passwordHash, string $role = 'student'): array
    {
        $normalizedEmail = trim(strtolower($email));
        $now = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d H:i:s.v');

        $user = [
            'id' => $id,
            'email' => $normalizedEmail,
            'passwordHash' => $passwordHash,
            'role' => $role,
            'createdAt' => $now,
            'updatedAt' => $now,
        ];

        if ($this->useMemory) {
            $this->memoryStore[$id] = $user;
            return $user;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO `User` (id, email, passwordHash, role, createdAt, updatedAt) VALUES (:id, :email, :passwordHash, :role, :createdAt, :updatedAt)'
        );
        $stmt->execute([
            'id' => $id,
            'email' => $normalizedEmail,
            'passwordHash' => $passwordHash,
            'role' => $role,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        return $user;
    }

    /**
     * Reset memory store (used in tests).
     */
    public function clearMemory(): void
    {
        if ($this->useMemory) {
            $this->memoryStore = [];
        }
    }
}
