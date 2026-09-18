-- ─── 04_calendar_table.sql ────────────────────────────────────────────────────
-- Converted from PostgreSQL (Supabase) to MySQL.

CREATE TABLE IF NOT EXISTS calendar_events (

  id          CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  user_id     CHAR(36) NOT NULL,

  -- What the event is (e.g., "Annual vaccination", "Sell calves at market").
  title       VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(title)) > 0),

  -- The day the event occurs. Stored as DATE (no time component) so calendar
  -- views can filter by year/month/day without time-zone complications.
  event_date  DATE NOT NULL,

  -- Category that determines which colour/icon the calendar uses.
  event_type  VARCHAR(20) NOT NULL DEFAULT 'other'
                CHECK (event_type IN ('vet', 'harvest', 'market', 'medication', 'other')),

  -- Optional free-text description or reminder notes.
  notes       TEXT,

  -- Track whether this event has been acted on (e.g., vet visit completed).
  completed   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Optionally link the event to a specific animal.
  animal_id   CHAR(36),

  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_calendar_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_calendar_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL

) ENGINE=InnoDB;


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Month view query: WHERE user_id = ? AND event_date BETWEEN start AND end
CREATE INDEX idx_calendar_user_date  ON calendar_events(user_id, event_date);

-- Filter by event type (e.g., show only vet visits on the calendar).
CREATE INDEX idx_calendar_event_type ON calendar_events(event_type);
