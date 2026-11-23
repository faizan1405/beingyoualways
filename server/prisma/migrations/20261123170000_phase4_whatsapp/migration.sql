-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `WhatsAppMessage` (
    `id` VARCHAR(191) NOT NULL,
    `direction` ENUM('OUTBOUND', 'INBOUND') NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `purpose` VARCHAR(40) NULL,
    `dedupeKey` VARCHAR(191) NULL,
    `waMessageId` VARCHAR(191) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `customerId` VARCHAR(30) NULL,
    `orderId` VARCHAR(30) NULL,
    `campaignId` VARCHAR(30) NULL,
    `templateName` VARCHAR(100) NULL,
    `language` VARCHAR(15) NULL,
    `params` JSON NULL,
    `body` TEXT NULL,
    `state` ENUM('QUEUED', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED', 'RECEIVED') NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NULL,
    `errorCode` INTEGER NULL,
    `errorTitle` VARCHAR(300) NULL,
    `errors` JSON NULL,
    `acceptedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `needsHuman` BOOLEAN NOT NULL DEFAULT false,
    `handledAt` DATETIME(3) NULL,
    `handledById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WhatsAppMessage_dedupeKey_key`(`dedupeKey`),
    UNIQUE INDEX `WhatsAppMessage_waMessageId_key`(`waMessageId`),
    INDEX `WhatsAppMessage_state_nextAttemptAt_idx`(`state`, `nextAttemptAt`),
    INDEX `WhatsAppMessage_kind_createdAt_idx`(`kind`, `createdAt`),
    INDEX `WhatsAppMessage_phone_createdAt_idx`(`phone`, `createdAt`),
    INDEX `WhatsAppMessage_orderId_idx`(`orderId`),
    INDEX `WhatsAppMessage_campaignId_state_idx`(`campaignId`, `state`),
    INDEX `WhatsAppMessage_direction_needsHuman_handledAt_idx`(`direction`, `needsHuman`, `handledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsAppWebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `field` VARCHAR(60) NOT NULL,
    `payload` JSON NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `outcome` VARCHAR(30) NULL,
    `processingError` VARCHAR(500) NULL,

    UNIQUE INDEX `WhatsAppWebhookEvent_dedupeKey_key`(`dedupeKey`),
    INDEX `WhatsAppWebhookEvent_processedAt_nextAttemptAt_idx`(`processedAt`, `nextAttemptAt`),
    INDEX `WhatsAppWebhookEvent_receivedAt_idx`(`receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsAppOtp` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `codeHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `consumedAt` DATETIME(3) NULL,
    `lockedUntil` DATETIME(3) NULL,
    `messageId` VARCHAR(30) NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WhatsAppOtp_phone_createdAt_idx`(`phone`, `createdAt`),
    INDEX `WhatsAppOtp_ip_createdAt_idx`(`ip`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AbandonedCheckout` (
    `id` VARCHAR(191) NOT NULL,
    `checkoutKey` VARCHAR(64) NOT NULL,
    `recoveryHash` CHAR(64) NULL,
    `customerId` VARCHAR(30) NULL,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `lines` JSON NOT NULL,
    `subtotalPaise` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'CONVERTED', 'REMINDED', 'SKIPPED', 'EXPIRED') NOT NULL DEFAULT 'OPEN',
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remindAt` DATETIME(3) NOT NULL,
    `orderId` VARCHAR(30) NULL,
    `messageId` VARCHAR(30) NULL,
    `skipReason` VARCHAR(200) NULL,
    `remindedAt` DATETIME(3) NULL,
    `recoveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AbandonedCheckout_checkoutKey_key`(`checkoutKey`),
    UNIQUE INDEX `AbandonedCheckout_recoveryHash_key`(`recoveryHash`),
    INDEX `AbandonedCheckout_status_remindAt_idx`(`status`, `remindAt`),
    INDEX `AbandonedCheckout_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsAppCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `templateName` VARCHAR(100) NOT NULL,
    `language` VARCHAR(15) NOT NULL,
    `segment` JSON NOT NULL,
    `params` JSON NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `scheduledAt` DATETIME(3) NULL,
    `maxRecipients` INTEGER NOT NULL,
    `recipientCount` INTEGER NULL,
    `createdById` VARCHAR(30) NULL,
    `approvedById` VARCHAR(30) NULL,
    `approvedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WhatsAppCampaign_status_scheduledAt_idx`(`status`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WhatsAppApiError` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `operation` VARCHAR(60) NOT NULL,
    `httpStatus` INTEGER NULL,
    `code` INTEGER NULL,
    `subcode` INTEGER NULL,
    `title` VARCHAR(300) NOT NULL,
    `detail` VARCHAR(500) NULL,
    `traceId` VARCHAR(80) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WhatsAppApiError_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobLease` (
    `name` VARCHAR(60) NOT NULL,
    `owner` VARCHAR(80) NOT NULL,
    `leaseUntil` DATETIME(3) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

