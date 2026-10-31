-- Evolutivo 17 (etapa 2): tarea de ajustes ligada a la revision, versiones de copy/arte y comentarios resueltos. Solo AGREGA columnas vacias y una tabla nueva. No toca ningun dato existente
-- AlterTable
ALTER TABLE `ReviewComment` ADD COLUMN `resolvedAt` DATETIME(3) NULL,
    ADD COLUMN `resolvedById` VARCHAR(191) NULL,
    ADD COLUMN `resolvedNote` TEXT NULL;

-- AlterTable
ALTER TABLE `ReviewSlide` ADD COLUMN `artVersion` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `copyVersion` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `Subtask` ADD COLUMN `reviewCommentId` VARCHAR(191) NULL,
    ADD COLUMN `reviewSlideId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Task` ADD COLUMN `reviewId` VARCHAR(191) NULL,
    ADD COLUMN `reviewRound` INTEGER NULL;

-- CreateTable
CREATE TABLE `ReviewCopyVersion` (
    `id` VARCHAR(191) NOT NULL,
    `slideId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `text` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReviewCopyVersion_slideId_idx`(`slideId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReviewCopyVersion` ADD CONSTRAINT `ReviewCopyVersion_slideId_fkey` FOREIGN KEY (`slideId`) REFERENCES `ReviewSlide`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

