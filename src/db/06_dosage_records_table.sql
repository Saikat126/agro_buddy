
CREATE TABLE IF NOT EXISTS dosage_records (

  id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  user_id         CHAR(36) NOT NULL,

  animal_id       CHAR(36),

  animal_name     VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(animal_name)) > 0),

  medication      VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(medication)) > 0),


  weight_kg       DECIMAL(8, 2) NOT NULL CHECK (weight_kg > 0),

  dose_per_kg     DECIMAL(8, 4) NOT NULL CHECK (dose_per_kg > 0),

  concentration   DECIMAL(8, 4) NOT NULL CHECK (concentration > 0),

  total_mg        DECIMAL(10, 4) NOT NULL,

  total_ml        DECIMAL(10, 4) NOT NULL,

  frequency_days  INT NOT NULL DEFAULT 1 CHECK (frequency_days > 0),

  duration_days   INT NOT NULL DEFAULT 7 CHECK (duration_days > 0),

  start_date      DATE NOT NULL DEFAULT (CURRENT_DATE),

  end_date        DATE NOT NULL,

  notes           TEXT,

  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_dosage_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_dosage_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL,

  -- Data integrity: end_date must come on or after start_date.
  CONSTRAINT end_after_start CHECK (end_date >= start_date)

) ENGINE=InnoDB;


-- Default history list: "WHERE user_id = ? ORDER BY created_at DESC".
CREATE INDEX idx_dosage_user_created ON dosage_records(user_id, created_at);

-- Per-animal history: "WHERE user_id = ? AND animal_id = ? ORDER BY start_date DESC".
CREATE INDEX idx_dosage_animal_user  ON dosage_records(animal_id, user_id);

-- Active treatments: "WHERE user_id = ? AND start_date <= today AND end_date >= today".
CREATE INDEX idx_dosage_user_dates   ON dosage_records(user_id, start_date, end_date);
