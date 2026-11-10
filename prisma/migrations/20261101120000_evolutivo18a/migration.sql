-- Evolutivo 18: titulo y tipo de cada slide de una revision, y varios canales por slide. AGREGA dos columnas vacias y AMPLIA la columna channel (de 12 a 40 caracteres). No toca ningun dato existente
-- AlterTable
ALTER TABLE `ReviewSlide` ADD COLUMN `title` VARCHAR(191) NULL,
    ADD COLUMN `kind` VARCHAR(12) NULL,
    MODIFY `channel` VARCHAR(40) NOT NULL DEFAULT 'FACEBOOK';
