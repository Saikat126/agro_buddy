-- ─── 01_animals_table.sql ─────────────────────────────────────────────────────
-- Converted from PostgreSQL (Supabase) to MySQL. See 00_users_table.sql for
-- why user_id now references a local `users` table, and for a note on where
-- the old "only see your own animals" RLS rule needs to be re-enforced.

CREATE TABLE IF NOT EXISTS animals (

  id          CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  -- Links this animal to the user who created it.
  user_id     CHAR(36) NOT NULL,

  -- The animal's name — required field, cannot be blank.
  name        VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(name)) > 0),

  -- Species like 'Cattle', 'Goat', 'Chicken', 'Sheep', etc.
  species     VARCHAR(100) NOT NULL CHECK (CHAR_LENGTH(TRIM(species)) > 0),

  -- Breed is optional (e.g., 'Holstein', 'Boer')
  breed       VARCHAR(100),

  -- Age in years stored as a decimal (e.g., 1.5 = 18 months). Zero or positive.
  age_years   DECIMAL(5, 2) CHECK (age_years >= 0),

  -- Body weight in kilograms. Must be positive if provided.
  weight_kg   DECIMAL(8, 2) CHECK (weight_kg > 0),

  -- Free-text notes (health observations, feeding notes, etc.)
  notes       TEXT,

  -- Optional photo URL (uploaded via the backend's file storage once that's built).
  image_url   VARCHAR(1024),

  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_animals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

) ENGINE=InnoDB;


-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_animals_user_id ON animals(user_id);
CREATE INDEX idx_animals_species ON animals(species);
