-- CreateTable
CREATE TABLE `ticket_counters` (
    `id` INT NOT NULL DEFAULT 1,
    `last_value` INT NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Initialize counter
INSERT INTO `ticket_counters` (`id`, `last_value`) VALUES (1, 0)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- AlterTable tickets: add column as NULL first to allow safe backfill
ALTER TABLE `tickets` ADD COLUMN `ticket_number` VARCHAR(32) NULL;

-- Backfill existing tickets in sequential order by created_at, id
UPDATE `tickets` t
JOIN (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) as row_num
    FROM `tickets`
) ranked ON t.id = ranked.id
SET t.ticket_number = CONCAT('TKT-', LPAD(ranked.row_num, 6, '0'))
WHERE t.ticket_number IS NULL;

-- Update counter last_value to match highest backfilled ticket number
UPDATE `ticket_counters`
SET `last_value` = (
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number, 5) AS UNSIGNED)), 0)
    FROM `tickets`
    WHERE `ticket_number` LIKE 'TKT-%'
)
WHERE `id` = 1;

-- AlterTable tickets: enforce NOT NULL and add UNIQUE constraint
ALTER TABLE `tickets` MODIFY COLUMN `ticket_number` VARCHAR(32) NOT NULL;
CREATE UNIQUE INDEX `tickets_ticket_number_key` ON `tickets`(`ticket_number`);
