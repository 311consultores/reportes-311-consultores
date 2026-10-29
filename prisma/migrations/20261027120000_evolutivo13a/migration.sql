-- Evolutivo 13: Prestamos de las cajas. Solo AGREGA: dos columnas vacias y cuatro valores nuevos de tipo en LedgerEntry, y tres tablas nuevas. No toca ningun dato existente
-- AlterTable
ALTER TABLE `LedgerEntry` ADD COLUMN `loanId` VARCHAR(191) NULL,
    ADD COLUMN `loanPaymentId` VARCHAR(191) NULL,
    MODIFY `kind` ENUM('DISTRIBUCION', 'REVERSA', 'GASTO', 'ANULA_GASTO', 'SALDO_INICIAL', 'TRASLADO', 'RETIRO', 'ANULA_MOVIMIENTO', 'PRESTAMO', 'ABONO_PRESTAMO', 'ANULA_PRESTAMO', 'ANULA_ABONO') NOT NULL;

-- CreateTable
CREATE TABLE `Loan` (
    `id` VARCHAR(191) NOT NULL,
    `concept` VARCHAR(200) NOT NULL,
    `recipient` VARCHAR(120) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `loanDate` DATE NOT NULL,
    `alreadyDeducted` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `voidedAt` DATETIME(3) NULL,
    `voidReason` VARCHAR(300) NULL,
    `voidedById` VARCHAR(191) NULL,

    INDEX `Loan_loanDate_idx`(`loanDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoanOrigin` (
    `id` VARCHAR(191) NOT NULL,
    `loanId` VARCHAR(191) NOT NULL,
    `box` ENUM('NOMINA', 'AHORRO', 'NAVIDAD', 'GASTOS', 'UTILIDAD', 'IMPUESTOS', 'MARKETING', 'GANANCIA_INTERNA', 'DEV', 'UTILIDAD_JOHNNY', 'UTILIDAD_YISUS') NOT NULL,
    `cashType` ENUM('EFECTIVO', 'BANCO') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,

    INDEX `LoanOrigin_loanId_idx`(`loanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoanPayment` (
    `id` VARCHAR(191) NOT NULL,
    `loanId` VARCHAR(191) NOT NULL,
    `box` ENUM('NOMINA', 'AHORRO', 'NAVIDAD', 'GASTOS', 'UTILIDAD', 'IMPUESTOS', 'MARKETING', 'GANANCIA_INTERNA', 'DEV', 'UTILIDAD_JOHNNY', 'UTILIDAD_YISUS') NOT NULL,
    `cashType` ENUM('EFECTIVO', 'BANCO') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `paidOn` DATE NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `voidedAt` DATETIME(3) NULL,
    `voidReason` VARCHAR(300) NULL,
    `voidedById` VARCHAR(191) NULL,

    INDEX `LoanPayment_loanId_idx`(`loanId`),
    INDEX `LoanPayment_paidOn_idx`(`paidOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `LedgerEntry_loanId_idx` ON `LedgerEntry`(`loanId`);

-- CreateIndex
CREATE INDEX `LedgerEntry_loanPaymentId_idx` ON `LedgerEntry`(`loanPaymentId`);

-- AddForeignKey
ALTER TABLE `Loan` ADD CONSTRAINT `Loan_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanOrigin` ADD CONSTRAINT `LoanOrigin_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanPayment` ADD CONSTRAINT `LoanPayment_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `Loan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanPayment` ADD CONSTRAINT `LoanPayment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
