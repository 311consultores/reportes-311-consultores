-- CreateTable
-- Evolutivo 11 (etapa 3): Las Retas (juego). Solo CREA una tabla nueva; no toca datos existentes
CREATE TABLE `GameScore` (
    `userId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(10) NOT NULL,
    `score` INTEGER NOT NULL,
    `achievedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GameScore_period_score_idx`(`period`, `score`),
    PRIMARY KEY (`userId`, `period`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GameScore` ADD CONSTRAINT `GameScore_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
