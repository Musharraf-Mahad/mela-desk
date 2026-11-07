-- AlterTable: Expand UserRole enum on users table
ALTER TABLE `users` MODIFY COLUMN `role` ENUM('customer', 'agent', 'department_head', 'head', 'admin') NOT NULL DEFAULT 'customer';

-- CreateTable: Create departments table
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `head_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `departments_name_key`(`name`),
    UNIQUE INDEX `departments_head_id_key`(`head_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: Add department_id to users table
ALTER TABLE `users` ADD COLUMN `department_id` VARCHAR(191) NULL;
CREATE INDEX `users_department_id_idx` ON `users`(`department_id`);

-- AlterTable: Add department_id to tickets table
ALTER TABLE `tickets` ADD COLUMN `department_id` VARCHAR(191) NULL;
CREATE INDEX `tickets_department_id_idx` ON `tickets`(`department_id`);

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_head_id_fkey` FOREIGN KEY (`head_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
