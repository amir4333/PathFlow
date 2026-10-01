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
     * Allowed logical tables in the PathFlow domain.
     */
    public const LOGICAL_TABLES = [
        'User',
        'Goal',
        'Roadmap',
        'Task',
        'Session',
        'WeeklyPlan',
        'WeeklyPlanItem',
        'SyncMutationRecord',
        'Tombstone',
        'TeacherAccessGrant',
    ];

    /**
     * Get and validate the configured database table prefix.
     * Defaults to 'pf_' if not explicitly defined.
     * Enforces strict regex validation ^[A-Za-z0-9_]*$ to prevent SQL injection.
     */
    public static function getPrefix(): string
    {
        $prefix = Config::get('DB_TABLE_PREFIX', 'pf_');
        if ($prefix === null || $prefix === '') {
            $prefix = 'pf_';
        }

        if (!preg_match('/^[A-Za-z0-9_]*$/', (string)$prefix)) {
            throw new \InvalidArgumentException(
                sprintf("Invalid DB_TABLE_PREFIX '%s'. Prefix must match pattern ^[A-Za-z0-9_]*$", $prefix)
            );
        }

        return (string)$prefix;
    }

    /**
     * Validate that the given name is a recognized PathFlow logical table.
     */
    public static function validateLogicalTable(string $logicalName): void
    {
        if (!in_array($logicalName, self::LOGICAL_TABLES, true)) {
            throw new \InvalidArgumentException(
                sprintf("Invalid logical table name '%s'. Must be one of: %s", $logicalName, implode(', ', self::LOGICAL_TABLES))
            );
        }
    }

    /**
     * Resolve logical table name to unquoted physical table name (e.g. 'User' -> 'pf_User').
     */
    public static function rawTable(string $logicalName): string
    {
        self::validateLogicalTable($logicalName);
        return self::getPrefix() . $logicalName;
    }

    /**
     * Resolve logical table name to quoted physical SQL identifier (e.g. 'User' -> '`pf_User`').
     */
    public static function table(string $logicalName): string
    {
        return '`' . self::rawTable($logicalName) . '`';
    }

    /**
     * Safe SQL placeholder resolver.
     * Converts trusted placeholders like {{User}} into backtick-quoted physical table identifiers like `pf_User`.
     */
    public static function sql(string $query): string
    {
        return preg_replace_callback('/\{\{([A-Za-z0-9_]+)\}\}/', function (array $matches): string {
            return self::table($matches[1]);
        }, $query);
    }

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
        $collation = $customOptions['collation'] ?? Config::get('DB_COLLATION', 'utf8mb4_unicode_ci');
        $socket = $customOptions['socket'] ?? Config::get('DB_SOCKET', '');

        if (!empty($socket)) {
            $dsn = sprintf('mysql:unix_socket=%s;dbname=%s;charset=%s', $socket, $database, $charset);
        } else {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $database, $charset);
        }

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => sprintf('SET NAMES %s COLLATE %s', $charset, $collation),
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
