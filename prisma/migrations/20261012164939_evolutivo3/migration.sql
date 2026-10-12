-- AlterTable
ALTER TABLE `Client` ADD COLUMN `billingEmail` VARCHAR(191) NULL,
    ADD COLUMN `billingName` VARCHAR(150) NULL,
    ADD COLUMN `billingPhone` VARCHAR(10) NULL,
    ADD COLUMN `city` VARCHAR(120) NULL,
    ADD COLUMN `colonia` VARCHAR(150) NULL,
    ADD COLUMN `constanciaUrl` VARCHAR(191) NULL,
    ADD COLUMN `contactEmail` VARCHAR(191) NULL,
    ADD COLUMN `contactName` VARCHAR(150) NULL,
    ADD COLUMN `contactPhone` VARCHAR(10) NULL,
    ADD COLUMN `legalName` VARCHAR(255) NULL,
    ADD COLUMN `postalCode` VARCHAR(5) NULL,
    ADD COLUMN `requiresInvoice` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `rfc` VARCHAR(13) NULL,
    ADD COLUMN `state` VARCHAR(120) NULL,
    ADD COLUMN `street` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `ClientRegistration` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip` VARCHAR(64) NULL,
    `companyName` VARCHAR(150) NOT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `requiresInvoice` BOOLEAN NOT NULL DEFAULT false,
    `legalName` VARCHAR(255) NULL,
    `rfc` VARCHAR(13) NULL,
    `street` VARCHAR(255) NULL,
    `colonia` VARCHAR(150) NULL,
    `postalCode` VARCHAR(5) NULL,
    `city` VARCHAR(120) NULL,
    `state` VARCHAR(120) NULL,
    `constanciaUrl` VARCHAR(191) NULL,
    `contactName` VARCHAR(150) NOT NULL,
    `contactPhone` VARCHAR(10) NOT NULL,
    `contactEmail` VARCHAR(191) NOT NULL,
    `billingName` VARCHAR(150) NOT NULL,
    `billingPhone` VARCHAR(10) NOT NULL,
    `billingEmail` VARCHAR(191) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `clientId` VARCHAR(191) NULL,

    UNIQUE INDEX `ClientRegistration_clientId_key`(`clientId`),
    INDEX `ClientRegistration_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClientRegistration` ADD CONSTRAINT `ClientRegistration_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientRegistration` ADD CONSTRAINT `ClientRegistration_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
