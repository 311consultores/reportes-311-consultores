-- Evolutivo 19 (etapa 3b): nomina semanal. Solo AGREGA una columna vacia en User (sueldo semanal) y una tabla nueva (PayrollWeek). No toca ningun dato existente
ALTER TABLE `User` ADD COLUMN `weeklyPay` DECIMAL(12, 2) NULL;

CREATE TABLE `PayrollWeek` (
    `id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `week` INTEGER NOT NULL,
    `payDate` DATE NOT NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'PROGRAMADA',
    `baseTotal` DECIMAL(12, 2) NOT NULL,
    `breakdown` TEXT NOT NULL,
    `adjustment` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `adjustmentNote` VARCHAR(300) NULL,
    `paidTotal` DECIMAL(12, 2) NULL,
    `expenseId` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `paidById` VARCHAR(191) NULL,
    `voidReason` VARCHAR(300) NULL,
    `reminderSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PayrollWeek_status_idx`(`status`),
    UNIQUE INDEX `PayrollWeek_year_week_key`(`year`, `week`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

