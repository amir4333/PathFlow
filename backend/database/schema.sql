-- PathFlow Production MySQL Schema
-- Configured for shared database environments using table prefix isolation
-- Prefix: pf_
-- Compatible with MySQL 8.x and MariaDB 10.4+
-- Engine: InnoDB, Charset: utf8mb4, Collation: utf8mb4_unicode_ci

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- Table 1: pf_User
-- System users (students and teachers)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pf_User` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'student',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `pf_User_email_key` (`email`),
  INDEX `pf_User_email_idx` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 2: pf_Goal
-- High-level learning and development objectives
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pf_Goal` (
  `id` VARCHAR(64) NOT NULL,
  `studentId` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'not_started',
  `createdAt` VARCHAR(64) NOT NULL,
  `updatedAt` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `pf_Goal_studentId_idx` (`studentId`),
  CONSTRAINT `pf_Goal_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `pf_User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 3: pf_Roadmap
-- Sequential learning tracks nested under a goal
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pf_Roadmap` (
  `id` VARCHAR(64) NOT NULL,
  `studentId` VARCHAR(36) NOT NULL,
  `goalId` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `createdAt` VARCHAR(64) NOT NULL,
  `updatedAt` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `pf_Roadmap_studentId_goalId_idx` (`studentId`, `goalId`),
  CONSTRAINT `pf_Roadmap_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `pf_User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 4: pf_Task
-- Actionable study tasks within a roadmap
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pf_Task` (
  `id` VARCHAR(64) NOT NULL,
  `studentId` VARCHAR(36) NOT NULL,
  `roadmapId` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'todo',
  `priority` VARCHAR(32) NOT NULL DEFAULT 'medium',
  `estimatedMinutes` INT NOT NULL DEFAULT 0,
  `createdAt` VARCHAR(64) NOT NULL,
  `updatedAt` VARCHAR(64) NOT NULL,
  `completedAt` VARCHAR(64) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `pf_Task_studentId_roadmapId_idx` (`studentId`, `roadmapId`),
  CONSTRAINT `pf_Task_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `pf_User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 5: pf_Session
-- Completed focused study and work sessions
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pf_Session` (
  `id` VARCHAR(64) NOT NULL,
  `studentId` VARCHAR(36) NOT NULL,
  `taskId` VARCHAR(64) NOT NULL,
  `startedAt` VARCHAR(64) NOT NULL,
  `endedAt` VARCHAR(64) NOT NULL,
  `durationMinutes` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `pf_Session_studentId_taskId_idx` (`studentId`, `taskId`),
  CONSTRAINT `pf_Session_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `pf_User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 6: pf_WeeklyPlan
-- Weekly planning allocation aggregate
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pf_WeeklyPlan` (
  `id` VARCHAR(64) NOT NULL,
  `studentId` VARCHAR(36) NOT NULL,
  `weekIdentifier` VARCHAR(32) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `targetMinutes` INT NOT NULL,
  `createdAt` VARCHAR(64) NOT NULL,
  `updatedAt` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `pf_WeeklyPlan_studentId_weekIdentifier_idx` (`studentId`, `weekIdentifier`),
  CONSTRAINT `pf_WeeklyPlan_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `pf_User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 7: pf_WeeklyPlanItem
-- Items scheduled within a weekly plan
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pf_WeeklyPlanItem` (
  `id` VARCHAR(64) NOT NULL,
  `studentId` VARCHAR(36) NOT NULL,
  `weeklyPlanId` VARCHAR(64) NOT NULL,
  `taskId` VARCHAR(64) NOT NULL,
  `targetDate` VARCHAR(64) NULL DEFAULT NULL,
  `plannedMinutes` INT NOT NULL,
  `isCompleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `pf_WeeklyPlanItem_studentId_weeklyPlanId_idx` (`studentId`, `weeklyPlanId`),
  CONSTRAINT `pf_WeeklyPlanItem_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `pf_User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 8: pf_SyncMutationRecord
-- Monotonic mutation ledger for delta synchronization
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pf_SyncMutationRecord` (
  `id` VARCHAR(36) NOT NULL,
  `studentId` VARCHAR(36) NOT NULL,
  `deviceId` VARCHAR(64) NOT NULL,
  `clientMutationId` VARCHAR(64) NOT NULL,
  `sequence` BIGINT NOT NULL AUTO_INCREMENT,
  `entityType` VARCHAR(32) NOT NULL,
  `entityId` VARCHAR(64) NOT NULL,
  `operation` VARCHAR(16) NOT NULL,
  `payload` LONGTEXT NULL,
  `timestamp` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `pf_SyncMutationRecord_sequence_key` (`sequence`),
  UNIQUE KEY `pf_SyncMutationRecord_studentId_deviceId_clientMutationId_key` (`studentId`, `deviceId`, `clientMutationId`),
  INDEX `pf_SyncMutationRecord_studentId_sequence_idx` (`studentId`, `sequence`),
  CONSTRAINT `pf_SyncMutationRecord_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `pf_User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 9: pf_Tombstone
-- Entity deletion markers for sync convergence
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pf_Tombstone` (
  `id` VARCHAR(36) NOT NULL,
  `studentId` VARCHAR(36) NOT NULL,
  `entityType` VARCHAR(32) NOT NULL,
  `entityId` VARCHAR(64) NOT NULL,
  `deletedAt` VARCHAR(64) NOT NULL,
  `sequence` BIGINT NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `pf_Tombstone_sequence_key` (`sequence`),
  UNIQUE KEY `pf_Tombstone_studentId_entityType_entityId_key` (`studentId`, `entityType`, `entityId`),
  INDEX `pf_Tombstone_studentId_sequence_idx` (`studentId`, `sequence`),
  CONSTRAINT `pf_Tombstone_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `pf_User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 10: pf_TeacherAccessGrant
-- Student-issued read-only access grants for mentors
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pf_TeacherAccessGrant` (
  `id` VARCHAR(36) NOT NULL,
  `studentId` VARCHAR(36) NOT NULL,
  `teacherId` VARCHAR(36) NULL DEFAULT NULL,
  `label` VARCHAR(255) NOT NULL,
  `token` VARCHAR(128) NOT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'read_only',
  `permissions` TEXT NOT NULL,
  `createdAt` VARCHAR(64) NOT NULL,
  `expiresAt` VARCHAR(64) NULL DEFAULT NULL,
  `revokedAt` VARCHAR(64) NULL DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pf_TeacherAccessGrant_token_key` (`token`),
  INDEX `pf_TeacherAccessGrant_token_idx` (`token`),
  INDEX `pf_TeacherAccessGrant_studentId_idx` (`studentId`),
  CONSTRAINT `pf_TeacherAccessGrant_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `pf_User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pf_TeacherAccessGrant_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `pf_User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
