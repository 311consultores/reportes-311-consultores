-- Evolutivo 17 (etapa 1): Revisiones de parrillas para redes sociales. Solo AGREGA tablas nuevas (Review, ReviewSlide, ReviewAsset, ReviewComment). No toca ningun dato existente
-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('BORRADOR', 'PUBLICADA', 'EN_AJUSTES', 'APROBADA') NOT NULL DEFAULT 'BORRADOR',
    `round` INTEGER NOT NULL DEFAULT 1,
    `notifyEmails` TEXT NOT NULL,
    `copyUserId` VARCHAR(191) NULL,
    `artUserId` VARCHAR(191) NULL,
    `respondBy` DATE NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedByName` VARCHAR(191) NULL,

    INDEX `Review_clientId_idx`(`clientId`),
    INDEX `Review_projectId_idx`(`projectId`),
    INDEX `Review_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewSlide` (
    `id` VARCHAR(191) NOT NULL,
    `reviewId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `channel` VARCHAR(12) NOT NULL DEFAULT 'FACEBOOK',
    `publishOn` DATE NULL,
    `copy` TEXT NOT NULL,
    `status` ENUM('PENDIENTE', 'CAMBIOS', 'AJUSTADO', 'APROBADO') NOT NULL DEFAULT 'PENDIENTE',
    `approvedAt` DATETIME(3) NULL,
    `approvedByName` VARCHAR(191) NULL,
    `reopenedReason` TEXT NULL,

    INDEX `ReviewSlide_reviewId_idx`(`reviewId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewAsset` (
    `id` VARCHAR(191) NOT NULL,
    `slideId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(300) NOT NULL,
    `type` VARCHAR(10) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReviewAsset_slideId_idx`(`slideId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewComment` (
    `id` VARCHAR(191) NOT NULL,
    `reviewId` VARCHAR(191) NOT NULL,
    `slideId` VARCHAR(191) NOT NULL,
    `target` ENUM('COPY', 'ART') NOT NULL,
    `round` INTEGER NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `imageNo` INTEGER NULL,
    `videoSec` INTEGER NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReviewComment_reviewId_idx`(`reviewId`),
    INDEX `ReviewComment_slideId_idx`(`slideId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_copyUserId_fkey` FOREIGN KEY (`copyUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_artUserId_fkey` FOREIGN KEY (`artUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewSlide` ADD CONSTRAINT `ReviewSlide_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewAsset` ADD CONSTRAINT `ReviewAsset_slideId_fkey` FOREIGN KEY (`slideId`) REFERENCES `ReviewSlide`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewComment` ADD CONSTRAINT `ReviewComment_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewComment` ADD CONSTRAINT `ReviewComment_slideId_fkey` FOREIGN KEY (`slideId`) REFERENCES `ReviewSlide`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReviewComment` ADD CONSTRAINT `ReviewComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
