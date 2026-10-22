-- AlterTable
-- Evolutivo 9b: telefono opcional del usuario (para WhatsApp). Solo agrega una columna vacia; no toca datos
ALTER TABLE `User` ADD COLUMN `phone` VARCHAR(20) NULL;
