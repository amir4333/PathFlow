<?php

declare(strict_types=1);

/**
 * PathFlow Production Database Initialization Script
 * Safely initializes all 10 MySQL/MariaDB tables and verifies structural invariants.
 *
 * Usage:
 *   php backend/database/init.php
 */

require_once dirname(__DIR__) . '/src/Support/Autoloader.php';
\PathFlow\Support\Autoloader::register();

use PathFlow\Config\Config;
use PathFlow\Database\Database;

Config::load();

echo "========================================================\n";
echo " PathFlow Production Database Initializer\n";
echo "========================================================\n\n";

$host = Config::get('DB_HOST', '127.0.0.1');
$port = Config::getInt('DB_PORT', 3306);
$dbname = Config::get('DB_DATABASE', 'pathflow_db');
$user = Config::get('DB_USERNAME', 'root');
$socket = Config::get('DB_SOCKET', '');

echo "Target Configuration:\n";
if (!empty($socket)) {
    echo "  Socket:   {$socket}\n";
} else {
    echo "  Host:     {$host}:{$port}\n";
}
echo "  Database: {$dbname}\n";
echo "  Username: {$user}\n\n";

try {
    $pdo = Database::getConnection();
    echo "✓ Database Connection: SUCCESS\n\n";
} catch (\Throwable $e) {
    echo "✗ Database Connection FAILED: " . $e->getMessage() . "\n\n";
    echo "Please verify that MySQL is running and your DB_* credentials in backend/.env are correct.\n";
    exit(1);
}

$schemaPath = __DIR__ . '/schema.sql';
if (!file_exists($schemaPath)) {
    echo "✗ Schema file missing at {$schemaPath}\n";
    exit(1);
}

$sql = file_get_contents($schemaPath);
if ($sql === false || trim($sql) === '') {
    echo "✗ Unable to read schema SQL or file is empty\n";
    exit(1);
}

echo "Executing schema initialization (CREATE TABLE IF NOT EXISTS)...\n";

try {
    // Execute SQL script
    $pdo->exec($sql);
    echo "✓ Schema executed successfully.\n\n";
} catch (\Throwable $e) {
    echo "✗ Schema execution failed: " . $e->getMessage() . "\n";
    exit(1);
}

// Now verify all tables
$expectedTables = [
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

echo "Verifying Schema Invariants:\n";
$stmt = $pdo->query("SHOW TABLES");
$existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);

$allPresent = true;
foreach ($expectedTables as $table) {
    if (in_array($table, $existingTables, true)) {
        echo "  ✓ Table '{$table}' verified\n";
    } else {
        echo "  ✗ Table '{$table}' MISSING\n";
        $allPresent = false;
    }
}

if (!$allPresent) {
    echo "\n✗ Database initialization incomplete.\n";
    exit(2);
}

echo "\n✓ Database initialization and verification completed successfully!\n";
exit(0);
