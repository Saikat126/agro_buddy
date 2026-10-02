
CREATE TABLE IF NOT EXISTS tasks (

  id           CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  user_id      CHAR(36) NOT NULL,

  title        VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(title)) > 0),

  due_date     DATE,

  priority     VARCHAR(10) NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high')),

  completed    BOOLEAN NOT NULL DEFAULT FALSE,

  is_repeating BOOLEAN NOT NULL DEFAULT FALSE,

  animal_id    CHAR(36),

  notes        TEXT,

  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tasks_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_tasks_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL

) ENGINE=InnoDB;


-- GET /api/tasks is always "WHERE user_id = ? ORDER BY due_date" — covers that.
CREATE INDEX idx_tasks_user_due           ON tasks(user_id, due_date);

-- GET /api/tasks?completed=... adds an equality filter before the same sort —
-- a separate composite since MySQL can't skip the middle column of one index.
CREATE INDEX idx_tasks_user_completed_due ON tasks(user_id, completed, due_date);

CREATE INDEX idx_tasks_repeating          ON tasks(is_repeating);
