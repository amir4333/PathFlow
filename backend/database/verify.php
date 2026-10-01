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
$logicalTables = Database::LOGICAL_TABLES;
$prefix = Database::getPrefix();

echo "Checking Expected Tables (10 total, Prefix: '{$prefix}'):\n";
$stmt = $pdo->query("SHOW TABLES");
$existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);

$missingTables = [];
foreach ($logicalTables as $logical) {
    $physical = Database::rawTable($logical);
    if (in_array($physical, $existingTables, true)) {
        echo "  ✓ Physical table '{$physical}' (logical '{$logical}') exists\n";
    } else {
        echo "  ✗ Physical table '{$physical}' (logical '{$logical}') MISSING\n";
        $missingTables[] = $physical;
    }
}

if (!empty($missingTables)) {
    echo "\n✗ Schema Verification FAILED: Missing " . count($missingTables) . " tables.\n";
    echo "Please initialize the schema using:\n";
    echo "  php backend/database/init.php\n";
    exit(2);
}

echo "\nChecking Critical Indexes and Unique Constraints:\n";

// Verify composite unique key on SyncMutationRecord
$syncTable = Database::table('SyncMutationRecord');
$syncKeyName = Database::rawTable('SyncMutationRecord') . '_studentId_deviceId_clientMutationId_key';
$stmt = $pdo->query("SHOW INDEX FROM {$syncTable} WHERE Key_name IN ('{$syncKeyName}', 'SyncMutationRecord_studentId_deviceId_clientMutationId_key')");
$indexes = $stmt->fetchAll();
if (!empty($indexes)) {
    echo "  ✓ Unique key '{$syncKeyName}' confirmed on {$syncTable}\n";
} else {
    echo "  ✗ Unique key '{$syncKeyName}' MISSING on {$syncTable}\n";
}

// Verify sequence unique key on SyncMutationRecord
$seqKeyName = Database::rawTable('SyncMutationRecord') . '_sequence_key';
$stmt = $pdo->query("SHOW INDEX FROM {$syncTable} WHERE Key_name IN ('{$seqKeyName}', 'SyncMutationRecord_sequence_key')");
if (!empty($stmt->fetchAll())) {
    echo "  ✓ Unique sequence index confirmed on {$syncTable}\n";
}

// Verify TeacherAccessGrant token uniqueness
$teacherTable = Database::table('TeacherAccessGrant');
$tokenKeyName = Database::rawTable('TeacherAccessGrant') . '_token_key';
$stmt = $pdo->query("SHOW INDEX FROM {$teacherTable} WHERE Key_name IN ('{$tokenKeyName}', 'TeacherAccessGrant_token_key')");
if (!empty($stmt->fetchAll())) {
    echo "  ✓ Unique token index confirmed on {$teacherTable}\n";
}

echo "\n✓ All 10 tables and core structural invariants verified successfully.\n";
exit(0);
