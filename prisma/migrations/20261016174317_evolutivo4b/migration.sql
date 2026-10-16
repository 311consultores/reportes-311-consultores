-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `distribution` TEXT NULL;

-- CreateTable
CREATE TABLE `LedgerEntry` (
    `id` VARCHAR(191) NOT NULL,
    `box` ENUM('NOMINA', 'AHORRO', 'NAVIDAD', 'GASTOS', 'UTILIDAD', 'IMPUESTOS', 'MARKETING', 'GANANCIA_INTERNA', 'DEV', 'UTILIDAD_JOHNNY', 'UTILIDAD_YISUS') NOT NULL,
    `cashType` ENUM('EFECTIVO', 'BANCO') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `kind` ENUM('DISTRIBUCION', 'REVERSA', 'GASTO', 'ANULA_GASTO', 'SALDO_INICIAL', 'TRASLADO', 'RETIRO', 'ANULA_MOVIMIENTO') NOT NULL,
    `occurredOn` DATE NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `expenseId` VARCHAR(191) NULL,
    `movementId` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LedgerEntry_box_cashType_idx`(`box`, `cashType`),
    INDEX `LedgerEntry_occurredOn_idx`(`occurredOn`),
    INDEX `LedgerEntry_invoiceId_idx`(`invoiceId`),
    INDEX `LedgerEntry_expenseId_idx`(`expenseId`),
    INDEX `LedgerEntry_movementId_idx`(`movementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` VARCHAR(191) NOT NULL,
    `concept` VARCHAR(200) NOT NULL,
    `kind` ENUM('NOMINA', 'OTRO') NOT NULL DEFAULT 'OTRO',
    `cashAmount` DECIMAL(12, 2) NOT NULL,
    `bankAmount` DECIMAL(12, 2) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `occurredOn` DATE NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `voidedAt` DATETIME(3) NULL,
    `voidReason` VARCHAR(300) NULL,
    `voidedById` VARCHAR(191) NULL,

    INDEX `Expense_occurredOn_idx`(`occurredOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Movement` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('SALDO_INICIAL', 'TRASLADO', 'RETIRO') NOT NULL,
    `fromBox` ENUM('NOMINA', 'AHORRO', 'NAVIDAD', 'GASTOS', 'UTILIDAD', 'IMPUESTOS', 'MARKETING', 'GANANCIA_INTERNA', 'DEV', 'UTILIDAD_JOHNNY', 'UTILIDAD_YISUS') NULL,
    `fromType` ENUM('EFECTIVO', 'BANCO') NULL,
    `toBox` ENUM('NOMINA', 'AHORRO', 'NAVIDAD', 'GASTOS', 'UTILIDAD', 'IMPUESTOS', 'MARKETING', 'GANANCIA_INTERNA', 'DEV', 'UTILIDAD_JOHNNY', 'UTILIDAD_YISUS') NULL,
    `toType` ENUM('EFECTIVO', 'BANCO') NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `concept` VARCHAR(200) NOT NULL,
    `occurredOn` DATE NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `voidedAt` DATETIME(3) NULL,
    `voidReason` VARCHAR(300) NULL,
    `voidedById` VARCHAR(191) NULL,

    INDEX `Movement_occurredOn_idx`(`occurredOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LedgerEntry` ADD CONSTRAINT `LedgerEntry_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LedgerEntry` ADD CONSTRAINT `LedgerEntry_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movement` ADD CONSTRAINT `Movement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
