-- Evolutivo 17 (etapa 3): recordatorio al cliente un dia antes de la fecha limite. Solo AGREGA una columna vacia en Review. No toca ningun dato existente
-- AlterTable
ALTER TABLE `Review` ADD COLUMN `reminderSentAt` DATETIME(3) NULL;
