-- ─── 05_vets_table.sql ────────────────────────────────────────────────────────
-- Converted from PostgreSQL (Supabase) to MySQL. map_link (originally added in
-- a separate migration) is folded straight into the table here since this is
-- a fresh MySQL schema rather than a live database with history to replay.
--
-- The old "public vets visible to everyone, private ones only to their owner"
-- RLS rule becomes a backend query condition:
--   WHERE is_public = TRUE OR user_id = req.user.id

CREATE TABLE IF NOT EXISTS vets (

  id          CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  -- The user who added this vet record (NULL = system/admin-seeded records).
  user_id     CHAR(36),

  -- Vet's full name.
  name        VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(name)) > 0),

  -- Area of expertise (e.g., 'Large Animals', 'Poultry', 'General Practice').
  specialty   VARCHAR(255),

  -- Clinic or hospital name.
  clinic      VARCHAR(255),

  -- Contact phone number (stored as text to preserve formatting like +880-...).
  phone       VARCHAR(50),

  -- Contact email address.
  email       VARCHAR(255),

  -- Town, city, or area (e.g., 'Dhaka', 'Sylhet').
  location    VARCHAR(255),

  -- Average star rating from 0.0 to 5.0.
  rating      DECIMAL(3, 1) CHECK (rating BETWEEN 0 AND 5),

  -- TRUE if the vet is currently accepting new patients / farm visits.
  available   BOOLEAN NOT NULL DEFAULT TRUE,

  -- TRUE = visible to all logged-in users (community directory).
  -- FALSE = private contact visible only to the user who added them.
  is_public   BOOLEAN NOT NULL DEFAULT TRUE,

  -- Optional link to the vet's location on a map service.
  map_link    VARCHAR(1024),

  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_vets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

) ENGINE=InnoDB;


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Search vets by location — the most common filter in the UI.
CREATE INDEX idx_vets_location         ON vets(location);

-- Filter by availability status quickly.
CREATE INDEX idx_vets_available        ON vets(available);

-- Composite index for the common pattern: public + available vets in a location.
CREATE INDEX idx_vets_public_available ON vets(is_public, available);
