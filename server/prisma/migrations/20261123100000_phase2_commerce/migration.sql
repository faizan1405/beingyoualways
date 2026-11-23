-- Phase 2: real orders, Razorpay/COD payments, stock reservations, order timeline, payment events, discount eligibility.
-- Stock that was never counted (Inventory.quantity NULL) is NOT orderable from this phase on.

-- AlterTable
ALTER TABLE `Discount` ADD COLUMN `categorySlugs` JSON NULL,
    ADD COLUMN `description` VARCHAR(200) NULL,
    ADD COLUMN `productIds` JSON NULL;

-- AlterTable
ALTER TABLE `Inventory` ADD COLUMN `reserved` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `cancelReason` VARCHAR(300) NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `carrier` VARCHAR(80) NULL,
    ADD COLUMN `cartHash` CHAR(64) NULL,
    ADD COLUMN `checkoutKey` VARCHAR(64) NULL,
    ADD COLUMN `codFee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `customerName` VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN `deliveredAt` DATETIME(3) NULL,
    ADD COLUMN `discountCode` VARCHAR(40) NULL,
    ADD COLUMN `isTest` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `paymentMethod` ENUM('RAZORPAY', 'COD') NOT NULL DEFAULT 'COD',
    ADD COLUMN `paymentStatus` ENUM('PENDING', 'COD_PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `reservationExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `shippedAt` DATETIME(3) NULL,
    ADD COLUMN `stockState` ENUM('NONE', 'RESERVED', 'COMMITTED', 'RELEASED', 'RESTORED') NOT NULL DEFAULT 'NONE',
    ADD COLUMN `trackingNumber` VARCHAR(80) NULL,
    ADD COLUMN `trackingUrl` VARCHAR(500) NULL,
    MODIFY `status` ENUM('PENDING_PAYMENT', 'NEW', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED') NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `capturedAt` DATETIME(3) NULL,
    ADD COLUMN `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    ADD COLUMN `failureReason` VARCHAR(255) NULL,
    ADD COLUMN `isTest` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `providerMethod` VARCHAR(30) NULL,
    ADD COLUMN `recordedById` VARCHAR(191) NULL,
    ADD COLUMN `reference` VARCHAR(120) NULL;

-- CreateTable
CREATE TABLE `OrderEvent` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

INDEX `OrderEvent_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentEvent` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(20) NOT NULL,
    `eventId` VARCHAR(120) NOT NULL,
    `eventType` VARCHAR(60) NOT NULL,
    `source` VARCHAR(20) NOT NULL,
    `signatureValid` BOOLEAN NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `providerOrderId` VARCHAR(100) NULL,
    `providerPaymentId` VARCHAR(100) NULL,
    `amountPaise` INTEGER NULL,
    `outcome` VARCHAR(40) NOT NULL,
    `detail` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

UNIQUE INDEX `PaymentEvent_eventId_key`(`eventId`),
    INDEX `PaymentEvent_orderId_createdAt_idx`(`orderId`, `createdAt`),
    INDEX `PaymentEvent_providerOrderId_idx`(`providerOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Order_checkoutKey_key` ON `Order`(`checkoutKey`);

-- CreateIndex
CREATE INDEX `Order_paymentStatus_createdAt_idx` ON `Order`(`paymentStatus`, `createdAt`);

-- CreateIndex
CREATE INDEX `Order_createdAt_idx` ON `Order`(`createdAt`);

-- AddForeignKey
ALTER TABLE `OrderEvent` ADD CONSTRAINT `OrderEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentEvent` ADD CONSTRAINT `PaymentEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentEvent` ADD CONSTRAINT `PaymentEvent_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


