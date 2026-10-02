
CREATE TABLE IF NOT EXISTS marketplace_items (

  id           CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  user_id      CHAR(36) NOT NULL,

  title        VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(title)) > 0),

  category     VARCHAR(50) NOT NULL
                 CHECK (category IN ('Livestock', 'Crops', 'Equipment', 'Supplies', 'Other')),

  price        DECIMAL(12, 2) NOT NULL CHECK (price > 0),

  unit         VARCHAR(100) NOT NULL CHECK (CHAR_LENGTH(TRIM(unit)) > 0),

  seller_name  VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(seller_name)) > 0),

  description  TEXT,

  image_url    VARCHAR(1024),

  available    BOOLEAN NOT NULL DEFAULT TRUE,

  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_marketplace_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

) ENGINE=InnoDB;


-- Category filter on its own (GET /api/marketplace?category=...).
CREATE INDEX idx_marketplace_category         ON marketplace_items(category);

-- The public browse query is "WHERE available = TRUE ORDER BY created_at DESC"
-- — this composite covers both the filter and the sort.
CREATE INDEX idx_marketplace_available_created ON marketplace_items(available, created_at);

-- "My listings" (GET /api/marketplace/mine) is "WHERE user_id = ? ORDER BY created_at DESC".
CREATE INDEX idx_marketplace_user_created      ON marketplace_items(user_id, created_at);
