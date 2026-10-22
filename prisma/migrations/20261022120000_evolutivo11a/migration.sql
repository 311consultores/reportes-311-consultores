-- AlterTable
-- Evolutivo 11 (etapa 1): tareas programadas. Solo agrega dos columnas vacias; no toca datos
ALTER TABLE `Task` ADD COLUMN `publishAt` DATETIME(3) NULL,
    ADD COLUMN `publishNotifiedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Task_publishAt_idx` ON `Task`(`publishAt`);
