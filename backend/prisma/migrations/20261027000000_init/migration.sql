-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('customer', 'agent', 'admin') NOT NULL DEFAULT 'customer',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tickets` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `assignee_id` VARCHAR(191) NULL,
    `subject` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `category` ENUM('billing', 'account', 'technical', 'orders', 'general') NOT NULL,
    `priority` ENUM('low', 'normal', 'high', 'urgent') NOT NULL,
    `status` ENUM('open', 'in_progress', 'pending', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tickets_customer_id_idx`(`customer_id`),
    INDEX `tickets_assignee_id_idx`(`assignee_id`),
    INDEX `tickets_status_idx`(`status`),
    INDEX `tickets_category_idx`(`category`),
    INDEX `tickets_priority_idx`(`priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comments` (
    `id` VARCHAR(191) NOT NULL,
    `ticket_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `is_internal` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `comments_ticket_id_idx`(`ticket_id`),
    INDEX `comments_author_id_idx`(`author_id`),
    INDEX `comments_is_internal_idx`(`is_internal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `ticket_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `action` VARCHAR(100) NOT NULL,
    `details` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_ticket_id_idx`(`ticket_id`),
    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
