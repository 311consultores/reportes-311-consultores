-- CreateTable
-- Evolutivo 12 (etapa 1): Campanas Meta. Solo CREA dos tablas nuevas; no toca datos existentes
CREATE TABLE `MetaAccount` (
    `id` VARCHAR(191) NOT NULL,
    `adAccountId` VARCHAR(40) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(10) NULL,
    `clientId` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MetaAccount_adAccountId_key`(`adAccountId`),
    INDEX `MetaAccount_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MetaAccess` (
    `userId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,

    INDEX `MetaAccess_accountId_idx`(`accountId`),
    PRIMARY KEY (`userId`, `accountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MetaAccount` ADD CONSTRAINT `MetaAccount_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetaAccess` ADD CONSTRAINT `MetaAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetaAccess` ADD CONSTRAINT `MetaAccess_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `MetaAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
