-- Evolutivo 20: nomina editable, ingresos directos a cajas, reembolsos sin comprobante y borradores de tareas.
-- Solo AMPLIA columnas y AGREGA una tabla: no borra ni modifica ningun dato existente.

-- Reembolsos: el comprobante pasa a ser opcional
ALTER TABLE `Reimbursement` MODIFY `receiptKey` VARCHAR(300) NULL, MODIFY `receiptName` VARCHAR(191) NULL, MODIFY `receiptType` VARCHAR(60) NULL;

-- Nomina: marca de semana editada a mano
ALTER TABLE `PayrollWeek` ADD COLUMN `edited` BOOLEAN NOT NULL DEFAULT false;

-- Cajas: dos tipos nuevos de movimiento y el enlace al ingreso directo
ALTER TABLE `LedgerEntry` ADD COLUMN `incomeId` VARCHAR(191) NULL,
    MODIFY `kind` ENUM('DISTRIBUCION', 'REVERSA', 'GASTO', 'ANULA_GASTO', 'SALDO_INICIAL', 'TRASLADO', 'RETIRO', 'ANULA_MOVIMIENTO', 'PRESTAMO', 'ABONO_PRESTAMO', 'ANULA_PRESTAMO', 'ANULA_ABONO', 'INGRESO_DIRECTO', 'ANULA_INGRESO') NOT NULL;
CREATE INDEX `LedgerEntry_incomeId_idx` ON `LedgerEntry`(`incomeId`);

CREATE TABLE `DirectIncome` (
    `id` VARCHAR(191) NOT NULL,
    `box` ENUM('NOMINA', 'AHORRO', 'NAVIDAD', 'GASTOS', 'UTILIDAD', 'IMPUESTOS', 'MARKETING', 'GANANCIA_INTERNA', 'DEV', 'UTILIDAD_JOHNNY', 'UTILIDAD_YISUS') NOT NULL,
    `cashType` ENUM('EFECTIVO', 'BANCO') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `concept` VARCHAR(200) NOT NULL,
    `reason` VARCHAR(300) NOT NULL,
    `origin` VARCHAR(10) NOT NULL DEFAULT 'CLIENTE',
    `originNote` VARCHAR(200) NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `occurredOn` DATE NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `voidedAt` DATETIME(3) NULL,
    `voidReason` VARCHAR(300) NULL,
    `voidedById` VARCHAR(191) NULL,

    INDEX `DirectIncome_box_idx`(`box`),
    INDEX `DirectIncome_occurredOn_idx`(`occurredOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DirectIncome` ADD CONSTRAINT `DirectIncome_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tareas: nuevo estado BORRADOR (un borrador conserva cliente, proyecto y fecha de entrega obligatorios)
ALTER TABLE `Task` MODIFY `status` ENUM('BORRADOR', 'PENDIENTE', 'EN_PROCESO', 'PARA_REVISAR', 'TERMINADA') NOT NULL DEFAULT 'PENDIENTE';
