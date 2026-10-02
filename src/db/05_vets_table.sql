
CREATE TABLE IF NOT EXISTS vets (

  id          CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  user_id     CHAR(36),

  name        VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(name)) > 0),

  specialty   VARCHAR(255),

  clinic      VARCHAR(255),

  phone       VARCHAR(50),

  email       VARCHAR(255),

  location    VARCHAR(255),

  rating      DECIMAL(3, 1) CHECK (rating BETWEEN 0 AND 5),

  available   BOOLEAN NOT NULL DEFAULT TRUE,

  is_public   BOOLEAN NOT NULL DEFAULT TRUE,

  map_link    VARCHAR(1024),

  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_vets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

) ENGINE=InnoDB;


-- NOTE on search: GET /api/vets?search=... matches name/specialty/clinic/location
-- with LIKE '%term%'. A leading-wildcard LIKE can't use a B-tree index no matter
-- what's indexed here — MySQL has to scan every row. A FULLTEXT index would fix
-- that, but MATCH/AGAINST has different matching rules (whole-word, stopwords,
-- 3+ char minimum) than substring LIKE, so swapping it in would change what
-- counts as a match. Left as a plain scan for now since the vets table is small;
-- worth revisiting with FULLTEXT if this directory grows large.
CREATE INDEX idx_vets_location         ON vets(location);

-- GET /api/vets?available=true ORDER BY rating DESC
CREATE INDEX idx_vets_available_rating ON vets(available, rating);

-- Visibility check "is_public = TRUE OR user_id = ?" on every /api/vets call.
CREATE INDEX idx_vets_public_available ON vets(is_public, available);
