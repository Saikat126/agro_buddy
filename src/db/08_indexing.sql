-- ─── 08_indexing.sql ────────────────────────────────────────────────────────


DELIMITER $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN p_table   VARCHAR(64),
  IN p_index   VARCHAR(64),
  IN p_columns VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
  ) THEN
    SET @sql = CONCAT('CREATE INDEX ', p_index, ' ON ', p_table, ' (', p_columns, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS drop_index_if_present $$
CREATE PROCEDURE drop_index_if_present(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
  ) THEN
    SET @sql = CONCAT('DROP INDEX ', p_index, ' ON ', p_table);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

-- ── animals ──────────────────────────────────────────────────────────────────
CALL add_index_if_missing('animals', 'idx_animals_user_created', 'user_id, created_at');
CALL drop_index_if_present('animals', 'idx_animals_user_id');

-- ── tasks ────────────────────────────────────────────────────────────────────
CALL add_index_if_missing('tasks', 'idx_tasks_user_due', 'user_id, due_date');
CALL add_index_if_missing('tasks', 'idx_tasks_user_completed_due', 'user_id, completed, due_date');
CALL drop_index_if_present('tasks', 'idx_tasks_user_id');
CALL drop_index_if_present('tasks', 'idx_tasks_due_date');
CALL drop_index_if_present('tasks', 'idx_tasks_completed');

-- ── marketplace_items ────────────────────────────────────────────────────────
CALL add_index_if_missing('marketplace_items', 'idx_marketplace_available_created', 'available, created_at');
CALL add_index_if_missing('marketplace_items', 'idx_marketplace_user_created', 'user_id, created_at');
CALL drop_index_if_present('marketplace_items', 'idx_marketplace_available');
CALL drop_index_if_present('marketplace_items', 'idx_marketplace_user_id');

-- ── calendar_events ──────────────────────────────────────────────────────────
CALL add_index_if_missing('calendar_events', 'idx_calendar_user_type_date', 'user_id, event_type, event_date');
CALL drop_index_if_present('calendar_events', 'idx_calendar_event_type');

-- ── vets ─────────────────────────────────────────────────────────────────────
CALL add_index_if_missing('vets', 'idx_vets_available_rating', 'available, rating');
CALL drop_index_if_present('vets', 'idx_vets_available');

-- ── dosage_records ───────────────────────────────────────────────────────────
CALL add_index_if_missing('dosage_records', 'idx_dosage_user_created', 'user_id, created_at');
CALL add_index_if_missing('dosage_records', 'idx_dosage_animal_user', 'animal_id, user_id');
CALL add_index_if_missing('dosage_records', 'idx_dosage_user_dates', 'user_id, start_date, end_date');
CALL drop_index_if_present('dosage_records', 'idx_dosage_user_id');
CALL drop_index_if_present('dosage_records', 'idx_dosage_animal_id');
CALL drop_index_if_present('dosage_records', 'idx_dosage_dates');

-- ── orders / order_items ─────────────────────────────────────────────────────
CALL add_index_if_missing('orders', 'idx_orders_buyer_created', 'buyer_id, created_at');
CALL add_index_if_missing('order_items', 'idx_order_items_order_seller', 'order_id, seller_id');
CALL drop_index_if_present('orders', 'idx_orders_buyer_id');
CALL drop_index_if_present('order_items', 'idx_order_items_order');

-- These procedures were only scaffolding for this one migration — drop them
-- once it's done so they don't linger in the schema.
DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS drop_index_if_present;
