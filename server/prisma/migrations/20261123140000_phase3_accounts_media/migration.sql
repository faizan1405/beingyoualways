-- AlterTable
ALTER TABLE `AdminActivityLog` MODIFY `meta` JSON NULL;

-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `lockedUntil` DATETIME(3) NULL,
    ADD COLUMN `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `passwordHash` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `Discount` MODIFY `categorySlugs` JSON NULL,
    MODIFY `productIds` JSON NULL;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `accessKey` VARCHAR(64) NULL,
    MODIFY `shippingSnapshot` JSON NOT NULL,
    MODIFY `notes` JSON NULL;

-- AlterTable
ALTER TABLE `OrderEvent` MODIFY `meta` JSON NULL;

-- AlterTable
ALTER TABLE `Product` MODIFY `ingredients` JSON NOT NULL,
    MODIFY `keyIngredients` JSON NULL,
    MODIFY `details` JSON NOT NULL,
    MODIFY `benefits` JSON NULL,
    MODIFY `concerns` JSON NULL,
    MODIFY `relatedSlugs` JSON NULL;

-- AlterTable
ALTER TABLE `Review` ADD COLUMN `category` VARCHAR(40) NULL,
    ADD COLUMN `city` VARCHAR(100) NULL,
    ADD COLUMN `placements` JSON NULL,
    MODIFY `media` JSON NULL;

-- AlterTable
ALTER TABLE `SiteContent` MODIFY `value` JSON NOT NULL;

-- AlterTable
ALTER TABLE `StoreSetting` MODIFY `value` JSON NOT NULL;

-- CreateTable
CREATE TABLE `CustomerSession` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,

    UNIQUE INDEX `CustomerSession_tokenHash_key`(`tokenHash`),
    INDEX `CustomerSession_customerId_idx`(`customerId`),
    INDEX `CustomerSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerToken` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `purpose` ENUM('VERIFY_EMAIL', 'RESET_PASSWORD', 'LINK_GOOGLE') NOT NULL,
    `target` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CustomerToken_tokenHash_key`(`tokenHash`),
    INDEX `CustomerToken_customerId_purpose_idx`(`customerId`, `purpose`),
    INDEX `CustomerToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('PRODUCT_IMAGE', 'GALLERY_SLIDE', 'REVIEW_PHOTO', 'REVIEW_VIDEO', 'POSTER', 'CONTENT_IMAGE') NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `originalName` VARCHAR(200) NOT NULL,
    `mime` VARCHAR(80) NOT NULL,
    `bytes` INTEGER NOT NULL,
    `checksum` CHAR(64) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `durationSec` DECIMAL(8, 2) NULL,
    `alt` VARCHAR(300) NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `variants` JSON NULL,
    `productId` VARCHAR(64) NULL,
    `reviewId` VARCHAR(191) NULL,
    `uploadedBy` VARCHAR(30) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `MediaAsset_storageKey_key`(`storageKey`),
    INDEX `MediaAsset_productId_status_position_idx`(`productId`, `status`, `position`),
    INDEX `MediaAsset_reviewId_status_idx`(`reviewId`, `status`),
    INDEX `MediaAsset_status_kind_idx`(`status`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Customer_deletedAt_idx` ON `Customer`(`deletedAt`);

-- CreateIndex
CREATE UNIQUE INDEX `Order_accessKey_key` ON `Order`(`accessKey`);

-- CreateIndex
CREATE INDEX `Review_status_verifiedPurchase_consentGiven_idx` ON `Review`(`status`, `verifiedPurchase`, `consentGiven`);

-- AddForeignKey
ALTER TABLE `CustomerSession` ADD CONSTRAINT `CustomerSession_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerToken` ADD CONSTRAINT `CustomerToken_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

