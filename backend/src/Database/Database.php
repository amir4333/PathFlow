<?php

declare(strict_types=1);

namespace PathFlow\Database;

use PDO;
use PDOException;
use PathFlow\Config\Config;

/**
 * Lightweight PDO database connection manager and transaction wrapper.
 * Strictly uses native prepared statements, exception mode, and utf8mb4 encoding.
 */
class Database
{
    private static ?PDO $pdo = null;

    /**
     * Get or initialize the PDO connection instance.
     * Supports configurable parameters or defaults to Config values.
     */
    public static function getConnection(?array $customOptions = null): PDO
    {
        if (self::$pdo !== null && $customOptions === null) {
            return self::$pdo;
        }

        $host = $customOptions['host'] ?? Config::get('DB_HOST', '127.0.0.1');
        $port = (int)($customOptions['port'] ?? Config::getInt('DB_PORT', 3306));
        $database = $customOptions['database'] ?? Config::get('DB_DATABASE', 'pathflow_db');
        $username = $customOptions['username'] ?? Config::get('DB_USERNAME', 'root');
        $password = $customOptions['password'] ?? Config::get('DB_PASSWORD', '');
        $charset = $customOptions['charset'] ?? Config::get('DB_CHARSET', 'utf8mb4');

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $database, $charset);

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => sprintf('SET NAMES %s COLLATE %s_unicode_ci', $charset, $charset),
        ];

        try {
            $instance = new PDO($dsn, $username, $password, $options);
            if ($customOptions === null) {
                self::$pdo = $instance;
            }
            return $instance;
        } catch (PDOException $e) {
            throw new PDOException('Database connection failed: ' . $e->getMessage(), (int)$e->getCode());
        }
    }

    /**
     * Set a custom PDO instance (useful for testing e.g. SQLite in memory or mock).
     */
    public static function setConnection(?PDO $pdo): void
    {
        self::$pdo = $pdo;
    }

    /**
     * Helper: begin transaction on the active PDO connection.
     */
    public static function beginTransaction(): bool
    {
        return self::getConnection()->beginTransaction();
    }

    /**
     * Helper: commit transaction on the active PDO connection.
     */
    public static function commit(): bool
    {
        return self::getConnection()->commit();
    }

    /**
     * Helper: rollback transaction on the active PDO connection.
     */
    public static function rollBack(): bool
    {
        return self::getConnection()->rollBack();
    }

    /**
     * Execute a callback inside an atomic database transaction.
     */
    public static function transaction(callable $callback): mixed
    {
        self::beginTransaction();
        try {
            $result = $callback(self::getConnection());
            self::commit();
            return $result;
        } catch (\Throwable $e) {
            if (self::getConnection()->inTransaction()) {
                self::rollBack();
            }
            throw $e;
        }
    }
}
