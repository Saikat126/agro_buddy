
CREATE TABLE IF NOT EXISTS calendar_events (

  id          CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  user_id     CHAR(36) NOT NULL,

  title       VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(title)) > 0),

  event_date  DATE NOT NULL,

  event_type  VARCHAR(20) NOT NULL DEFAULT 'other'
                CHECK (event_type IN ('vet', 'harvest', 'market', 'medication', 'other')),

  notes       TEXT,

  completed   BOOLEAN NOT NULL DEFAULT FALSE,

  animal_id   CHAR(36),

  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_calendar_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_calendar_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL

) ENGINE=InnoDB;


-- Default list and the month-range query (GET /api/calendar?year=&month=)
-- are both "WHERE user_id = ? [AND event_date BETWEEN ? AND ?] ORDER BY event_date".
CREATE INDEX idx_calendar_user_date      ON calendar_events(user_id, event_date);

-- GET /api/calendar?type=... adds an event_type equality filter before the
-- same sort, so it needs its own composite (event_type alone has low
-- selectivity — only 5 distinct values — so an index on it by itself wasn't
-- pulling its weight anyway).
CREATE INDEX idx_calendar_user_type_date ON calendar_events(user_id, event_type, event_date);
