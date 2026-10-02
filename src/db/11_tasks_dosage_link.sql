-- ─── 11_tasks_dosage_link.sql ───────────────────────────────────────────────
-- Links tasks to the dosage record that spawned them, so a treatment
-- reminder can be kept in sync with (and cleaned up alongside) its record.
-- Must run after both 02_tasks_table.sql and 06_dosage_records_table.sql —
-- hence a separate file here rather than editing either of those directly.

ALTER TABLE tasks
  ADD COLUMN dosage_record_id CHAR(36),
  ADD CONSTRAINT fk_tasks_dosage_record
    FOREIGN KEY (dosage_record_id) REFERENCES dosage_records(id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_dosage_record ON tasks(dosage_record_id);
