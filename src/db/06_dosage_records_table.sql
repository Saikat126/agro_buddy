-- ─── 06_dosage_records_table.sql ──────────────────────────────────────────────
-- Converted from PostgreSQL (Supabase) to MySQL.

CREATE TABLE IF NOT EXISTS dosage_records (

  id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  user_id         CHAR(36) NOT NULL,

  -- Optional link to the animals table. SET NULL if the animal record is later
  -- deleted — we keep the dosage history even without the animal profile.
  animal_id       CHAR(36),

  -- Snapshot of the animal's name at save time (so history is readable even
  -- after the animal record is deleted or renamed).
  animal_name     VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(animal_name)) > 0),

  -- The medication or drug name (e.g., 'Oxytetracycline', 'Ivermectin').
  medication      VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(medication)) > 0),

  -- ── Inputs to the dosage calculation ──────────────────────────────────────
  -- These three values are what the user entered before hitting "Calculate".

  -- Animal body weight in kg at the time of calculation.
  weight_kg       DECIMAL(8, 2) NOT NULL CHECK (weight_kg > 0),

  -- Prescribed dose rate in mg per kg of body weight.
  dose_per_kg     DECIMAL(8, 4) NOT NULL CHECK (dose_per_kg > 0),

  -- Medication concentration in mg per ml (from the drug label).
  concentration   DECIMAL(8, 4) NOT NULL CHECK (concentration > 0),

  -- ── Results from the dosage calculation ───────────────────────────────────
  -- Computed by DosageCalculatorLogic.js and stored here for reference.

  -- Total milligrams needed: weight_kg × dose_per_kg
  total_mg        DECIMAL(10, 4) NOT NULL,

  -- Volume in ml to administer: total_mg / concentration
  total_ml        DECIMAL(10, 4) NOT NULL,

  -- ── Treatment schedule ────────────────────────────────────────────────────
  -- How often to give the dose (1 = daily, 7 = weekly, etc.)
  frequency_days  INT NOT NULL DEFAULT 1 CHECK (frequency_days > 0),

  -- How many days the full treatment course lasts.
  duration_days   INT NOT NULL DEFAULT 7 CHECK (duration_days > 0),

  -- First day of treatment.
  start_date      DATE NOT NULL DEFAULT (CURRENT_DATE),

  -- Last day of treatment: calculated as start_date + duration_days.
  -- Storing it avoids recalculating every time the history is displayed.
  end_date        DATE NOT NULL,

  -- Any extra notes the farmer added (withdrawal period reminders, etc.)
  notes           TEXT,

  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_dosage_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_dosage_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL,

  -- Data integrity: end_date must come on or after start_date.
  CONSTRAINT end_after_start CHECK (end_date >= start_date)

) ENGINE=InnoDB;


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- History page: all records for this user, newest first.
CREATE INDEX idx_dosage_user_id   ON dosage_records(user_id);

-- Filter history by animal.
CREATE INDEX idx_dosage_animal_id ON dosage_records(animal_id);

-- Date-range queries (e.g., "show treatments active this week").
CREATE INDEX idx_dosage_dates     ON dosage_records(start_date, end_date);
