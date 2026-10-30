-- Evolutivo 15 (etapa 2): cambio de perfil del Administrador. Solo AGREGA una columna vacia y su indice unico en User. No toca ningun dato existente
-- AlterTable
ALTER TABLE `User` ADD COLUMN `linkedUserId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_linkedUserId_key` ON `User`(`linkedUserId`);
