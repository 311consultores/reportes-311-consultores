-- Evolutivo 19 (etapa 3): reembolsos del TEAM 311. Solo AGREGA una columna vacia en Expense y una tabla nueva (Reimbursement). No toca ningun dato existente
ALTER TABLE `Expense` ADD COLUMN `box` ENUM('NOMINA', 'AHORRO', 'NAVIDAD', 'GASTOS', 'UTILIDAD', 'IMPUESTOS', 'MARKETING', 'GANANCIA_INTERNA', 'DEV', 'UTILIDAD_JOHNNY', 'UTILIDAD_YISUS') NULL;

CREATE TABLE `Reimbursement` (
    `id` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `concept` VARCHAR(200) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `spentOn` DATE NOT NULL,
    `urgency` VARCHAR(12) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `receiptKey` VARCHAR(300) NOT NULL,
    `receiptName` VARCHAR(191) NOT NULL,
    `receiptType` VARCHAR(60) NOT NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'SOLICITADO',
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `rejectReason` VARCHAR(300) NULL,
    `paidById` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `expenseId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Reimbursement_requestedById_idx`(`requestedById`),
    INDEX `Reimbursement_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Reimbursement` ADD CONSTRAINT `Reimbursement_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

