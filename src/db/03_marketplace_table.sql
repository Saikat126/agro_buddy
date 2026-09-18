-- ─── 03_marketplace_table.sql ─────────────────────────────────────────────────
-- Converted from PostgreSQL (Supabase) to MySQL.
--
-- The old "anyone can view available listings" RLS policy (and its later
-- fix_marketplace_public_read.sql patch) becomes a plain rule in the backend:
-- GET /marketplace has no auth check at all, while POST/PUT/DELETE require the
-- caller to be authenticated and own the row (WHERE user_id = req.user.id).

CREATE TABLE IF NOT EXISTS marketplace_items (

  id           CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  -- The farmer who posted this listing.
  user_id      CHAR(36) NOT NULL,

  -- Display title for the listing (e.g., "Friesian Cow — 3 years old").
  title        VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(title)) > 0),

  -- Product category. CHECK restricts to the predefined list so the UI's
  -- category filter always matches valid database values.
  category     VARCHAR(50) NOT NULL
                 CHECK (category IN ('Livestock', 'Crops', 'Equipment', 'Supplies', 'Other')),

  -- Price in local currency (up to 99,999,999,999.99). Must be positive.
  price        DECIMAL(12, 2) NOT NULL CHECK (price > 0),

  -- Unit of sale (e.g., "per head", "per kg", "each").
  unit         VARCHAR(100) NOT NULL CHECK (CHAR_LENGTH(TRIM(unit)) > 0),

  -- Seller's display name (can differ from the account's own name).
  seller_name  VARCHAR(255) NOT NULL CHECK (CHAR_LENGTH(TRIM(seller_name)) > 0),

  -- Longer description of the product.
  description  TEXT,

  -- Optional URL to a product image.
  image_url    VARCHAR(1024),

  -- Whether this listing is still active. Sellers can "hide" a listing
  -- without deleting it by setting this to FALSE.
  available    BOOLEAN NOT NULL DEFAULT TRUE,

  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_marketplace_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

) ENGINE=InnoDB;


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Browsing and filtering by category is the most common query.
CREATE INDEX idx_marketplace_category  ON marketplace_items(category);

-- Filter to show only available listings efficiently.
CREATE INDEX idx_marketplace_available ON marketplace_items(available);

-- Seller's own listings page: quick lookup by user_id.
CREATE INDEX idx_marketplace_user_id   ON marketplace_items(user_id);
