/*
  Warnings:

  - You are about to drop the column `evidenceType` on the `reporttask` table. All the data in the column will be lost.
  - You are about to drop the column `evidenceUrl` on the `reporttask` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Client` ADD COLUMN `folioSeq` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `DeletionRequest` ADD COLUMN `targetLabel` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TaskEvidence` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskEvidence_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Conserva la evidencia que cada actividad tenía (una sola) en la tabla nueva
INSERT INTO `TaskEvidence` (`id`, `taskId`, `url`, `type`, `createdAt`)
SELECT UUID(), `id`, `evidenceUrl`, `evidenceType`, NOW(3) FROM `ReportTask` WHERE `evidenceUrl` IS NOT NULL AND `evidenceType` IS NOT NULL;

-- AlterTable
ALTER TABLE `ReportTask` DROP COLUMN `evidenceType`,
    DROP COLUMN `evidenceUrl`,
    ADD COLUMN `title` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `theme` VARCHAR(10) NULL;

-- CreateTable
CREATE TABLE `PasswordReset` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordReset_tokenHash_key`(`tokenHash`),
    INDEX `PasswordReset_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskEvidence` ADD CONSTRAINT `TaskEvidence_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `ReportTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordReset` ADD CONSTRAINT `PasswordReset_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
