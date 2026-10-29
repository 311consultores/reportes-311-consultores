-- Evolutivo 14 (etapa 1): modulo Documentos (recibos de pago, acuerdos de confidencialidad y, despues, contratos). Solo AGREGA: seis columnas vacias en Client y dos tablas nuevas. No toca ningun dato existente
-- AlterTable
ALTER TABLE `Client` ADD COLUMN `legalRepAddress` VARCHAR(300) NULL,
    ADD COLUMN `legalRepCurp` VARCHAR(18) NULL,
    ADD COLUMN `legalRepIne` VARCHAR(20) NULL,
    ADD COLUMN `legalRepName` VARCHAR(150) NULL,
    ADD COLUMN `legalRepRole` VARCHAR(120) NULL,
    ADD COLUMN `receiptSeq` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('RECIBO', 'ACUERDO', 'CONTRATO') NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `folio` VARCHAR(40) NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `data` LONGTEXT NOT NULL,
    `status` ENUM('BORRADOR', 'ENVIADO') NOT NULL DEFAULT 'BORRADOR',
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `sentAt` DATETIME(3) NULL,

    INDEX `Document_clientId_idx`(`clientId`),
    INDEX `Document_kind_createdAt_idx`(`kind`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentSend` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `sentById` VARCHAR(191) NOT NULL,
    `toEmails` TEXT NOT NULL,
    `bccEmails` TEXT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `body` TEXT NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DocumentSend_documentId_idx`(`documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentSend` ADD CONSTRAINT `DocumentSend_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentSend` ADD CONSTRAINT `DocumentSend_sentById_fkey` FOREIGN KEY (`sentById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
