-- AlterTable: Make customer_id nullable and add guest fields & tracking token hash
ALTER TABLE `tickets` MODIFY `customer_id` VARCHAR(191) NULL;
ALTER TABLE `tickets` ADD COLUMN `guest_name` VARCHAR(120) NULL;
ALTER TABLE `tickets` ADD COLUMN `guest_email` VARCHAR(255) NULL;
ALTER TABLE `tickets` ADD COLUMN `tracking_token_hash` CHAR(64) NULL;

-- CreateIndex
CREATE INDEX `tickets_tracking_token_hash_idx` ON `tickets`(`tracking_token_hash`);

-- CreateTable: attachments
CREATE TABLE `attachments` (
    `id` VARCHAR(191) NOT NULL,
    `ticket_id` VARCHAR(191) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `stored_filename` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `storage_path` VARCHAR(500) NOT NULL,
    `uploaded_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attachments_ticket_id_idx`(`ticket_id`),
    INDEX `attachments_uploaded_by_id_idx`(`uploaded_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
