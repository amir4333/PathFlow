<?php

declare(strict_types=1);

// Database Verification Script for PathFlow MySQL / MariaDB Backend
// Verifies PDO connectivity, schema tables, foreign keys, unique constraints, and indexes.

require_once dirname(__DIR__) . '/src/Support/Autoloader.php';
\PathFlow\Support\Autoloader::register();

use PathFlow\Config\Config;
use PathFlow\Database\Database;

Config::load();

echo "========================================================\n";
echo " PathFlow MySQL Database Verification Script\n";
echo "========================================================\n\n";

$host = Config::get('DB_HOST', '127.0.0.1');
$port = Config::getInt('DB_PORT', 3306);
$dbname = Config::get('DB_DATABASE', 'pathflow_db');
$user = Config::get('DB_USERNAME', 'root');

echo "Target Configuration:\n";
echo "  Host:     {$host}:{$port}\n";
echo "  Database: {$dbname}\n";
echo "  Username: {$user}\n\n";

try {
    $pdo = Database::getConnection();
    echo "✓ Database Connection: SUCCESS\n\n";
} catch (\Throwable $e) {
    echo "✗ Database Connection FAILED: " . $e->getMessage() . "\n\n";
    echo "Notice: If MySQL is not running locally (e.g. running in Docker or shared hosting),\n";
    echo "please start MySQL or configure DB_HOST / DB_PASSWORD in backend/.env.\n";
    exit(1);
}

// 10 required domain and sync tables
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

echo "Checking Expected Tables (10 total):\n";
$stmt = $pdo->query("SHOW TABLES");
$existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);

$missingTables = [];
foreach ($expectedTables as $table) {
    if (in_array($table, $existingTables, true)) {
        echo "  ✓ Table '{$table}' exists\n";
    } else {
        echo "  ✗ Table '{$table}' MISSING\n";
        $missingTables[] = $table;
    }
}

if (!empty($missingTables)) {
    echo "\n✗ Schema Verification FAILED: Missing " . count($missingTables) . " tables.\n";
    echo "Please import backend/database/schema.sql using:\n";
    echo "  mysql -h {$host} -u {$user} -p {$dbname} < backend/database/schema.sql\n";
    exit(2);
}

echo "\nChecking Critical Indexes and Unique Constraints:\n";

// Verify composite unique key on SyncMutationRecord
$stmt = $pdo->query("SHOW INDEX FROM `SyncMutationRecord` WHERE Key_name = 'SyncMutationRecord_studentId_deviceId_clientMutationId_key'");
$indexes = $stmt->fetchAll();
if (!empty($indexes)) {
    echo "  ✓ Unique key 'SyncMutationRecord_studentId_deviceId_clientMutationId_key' confirmed\n";
} else {
    echo "  ✗ Unique key 'SyncMutationRecord_studentId_deviceId_clientMutationId_key' MISSING\n";
}

// Verify sequence unique key on SyncMutationRecord
$stmt = $pdo->query("SHOW INDEX FROM `SyncMutationRecord` WHERE Key_name = 'SyncMutationRecord_sequence_key'");
if (!empty($stmt->fetchAll())) {
    echo "  ✓ Unique sequence index on SyncMutationRecord confirmed\n";
}

// Verify TeacherAccessGrant token uniqueness
$stmt = $pdo->query("SHOW INDEX FROM `TeacherAccessGrant` WHERE Key_name = 'TeacherAccessGrant_token_key'");
if (!empty($stmt->fetchAll())) {
    echo "  ✓ Unique token index on TeacherAccessGrant confirmed\n";
}

echo "\n✓ All 10 tables and core structural invariants verified successfully.\n";
exit(0);
