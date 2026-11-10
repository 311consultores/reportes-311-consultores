-- Evolutivo 19 (etapa 2): tareas encadenadas. Solo AGREGA 4 columnas vacias, un indice y una llave en Task. No toca ningun dato existente
ALTER TABLE `Task` ADD COLUMN `activatedAt` DATETIME(3) NULL,
    ADD COLUMN `prevTaskId` VARCHAR(191) NULL,
    ADD COLUMN `waitDays` INTEGER NULL,
    ADD COLUMN `waitHours` INTEGER NULL;

CREATE INDEX `Task_prevTaskId_idx` ON `Task`(`prevTaskId`);

ALTER TABLE `Task` ADD CONSTRAINT `Task_prevTaskId_fkey` FOREIGN KEY (`prevTaskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

