-- ─── 02_tasks_table.sql ───────────────────────────────────────────────────────
-- Converted from PostgreSQL (Supabase) to MySQL. is_repeating (originally added
-- in a separate migration) is folded straight into the table here since this is
-- a fresh MySQL schema rather than a live database with history to replay.

CREATE TABLE IF NOT EXISTS tasks (

  id           CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  -- The user who owns this task.
  user_id      CHAR(36) NOT NULL,

  -- Short description of the task (e.g., "Vaccinate herd", "Repair fence").
  title        VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(title)) > 0),

  -- Optional: the date this task should be completed by (stored as a date, no time).
  due_date     DATE,

  -- Priority level. CHECK restricts values to exactly these three strings.
  priority     VARCHAR(10) NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high')),

  -- Whether the task is done. Starts as FALSE (not done).
  completed    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Whether this task recurs (daily/weekly/etc. — the actual cadence logic
  -- lives in the frontend/backend, this just flags that it repeats).
  is_repeating BOOLEAN NOT NULL DEFAULT FALSE,

  -- Optional link to an animal (e.g., "Vaccinate Bessie the cow").
  -- ON DELETE SET NULL: if the animal is deleted, the task stays but loses the link.
  animal_id    CHAR(36),

  -- Any extra context about the task.
  notes        TEXT,

  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tasks_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_tasks_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL

) ENGINE=InnoDB;


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Speed up the common query pattern: "all tasks for this user, ordered by due date"
CREATE INDEX idx_tasks_user_id   ON tasks(user_id);
CREATE INDEX idx_tasks_due_date  ON tasks(due_date);

-- Filtering by completion status / repeating flag.
CREATE INDEX idx_tasks_completed ON tasks(completed);
CREATE INDEX idx_tasks_repeating ON tasks(is_repeating);
