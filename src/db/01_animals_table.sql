
CREATE TABLE IF NOT EXISTS animals (

  id          CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  user_id     CHAR(36) NOT NULL,

  name        VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(name)) > 0),

  species     VARCHAR(100) NOT NULL CHECK (CHAR_LENGTH(TRIM(species)) > 0),

  breed       VARCHAR(100),

  age_years   DECIMAL(5, 2) CHECK (age_years >= 0),

  weight_kg   DECIMAL(8, 2) CHECK (weight_kg > 0),

  notes       TEXT,

  image_url   VARCHAR(1024),

  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_animals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

) ENGINE=InnoDB;


-- Every animals query is "WHERE user_id = ? ORDER BY created_at DESC" (see
-- GET /api/animals) — this composite covers both the filter and the sort so
-- MySQL doesn't need a separate filesort pass.
CREATE INDEX idx_animals_user_created ON animals(user_id, created_at);
CREATE INDEX idx_animals_species      ON animals(species);
