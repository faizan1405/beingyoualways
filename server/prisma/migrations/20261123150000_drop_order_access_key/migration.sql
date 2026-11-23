-- A shopper's private order link is already proved by the key the server gave them (the same proof the
-- order page uses). A second stored per-order secret would be unused, so it is removed.
DROP INDEX `Order_accessKey_key` ON `Order`;
ALTER TABLE `Order` DROP COLUMN `accessKey`;
