-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('FACTURA', 'RECIBO') NOT NULL DEFAULT 'FACTURA',
    `number` VARCHAR(60) NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `rfc` VARCHAR(13) NULL,
    `description` VARCHAR(500) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `vat` DECIMAL(12, 2) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `isSoftware` BOOLEAN NOT NULL DEFAULT false,
    `dueDate` DATE NOT NULL,
    `status` ENUM('ENVIADA', 'PAGADA') NOT NULL DEFAULT 'ENVIADA',
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `collectedOn` DATE NULL,
    `account` ENUM('CAJA_CHICA', 'TRIADA', 'JOHNNY_EFECTIVO', 'JOHNNY_TRANS', 'YISUS_EFECTIVO', 'YISUS_TRANS') NULL,
    `paidById` VARCHAR(191) NULL,

    INDEX `Invoice_clientId_idx`(`clientId`),
    INDEX `Invoice_status_dueDate_idx`(`status`, `dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceLog` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `details` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InvoiceLog_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_paidById_fkey` FOREIGN KEY (`paidById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLog` ADD CONSTRAINT `InvoiceLog_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLog` ADD CONSTRAINT `InvoiceLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
