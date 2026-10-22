-- Evolutivo 10 (etapa 1): areas del equipo. Solo CREA tablas y agrega una columna vacia; no toca ningun dato existente.

-- AlterTable
ALTER TABLE `Task` ADD COLUMN `areaId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Area` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(9) NOT NULL DEFAULT '#007AFF',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Area_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserArea` (
    `userId` VARCHAR(191) NOT NULL,
    `areaId` VARCHAR(191) NOT NULL,

    INDEX `UserArea_areaId_idx`(`areaId`),
    PRIMARY KEY (`userId`, `areaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Task_areaId_idx` ON `Task`(`areaId`);

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `Area`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserArea` ADD CONSTRAINT `UserArea_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserArea` ADD CONSTRAINT `UserArea_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `Area`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Areas iniciales
INSERT INTO `Area` (`id`, `name`, `color`) VALUES
  (UUID(), 'DISEÑO', '#AF52DE'),
  (UUID(), 'CRM', '#007AFF'),
  (UUID(), 'CONSULTORÍA', '#34C759'),
  (UUID(), 'DESARROLLO', '#5856D6'),
  (UUID(), 'DIRECCIÓN', '#FF3B30'),
  (UUID(), 'REDES Y ADS', '#FF9500'),
  (UUID(), 'WEB', '#00C7BE');

-- Fecha desde la que se miden las metricas del dashboard de desempeno (el Administrador puede cambiarla ahi)
INSERT IGNORE INTO `AppSetting` (`key`, `value`) VALUES ('metrics_start', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%s.000Z'));
