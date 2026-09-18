-- ─── 07_orders_table.sql ──────────────────────────────────────────────────────
-- Converted from PostgreSQL (Supabase) to MySQL.
--
-- The original Postgres version needed two SECURITY DEFINER helper functions
-- (get_order_buyer_id / seller_has_items_in_order) plus several follow-up
-- patches (fix_orders_rls_recursion.sql, fix_orders_seller_update_policy.sql,
-- fix_seller_order_policy.sql) just to stop RLS policies on orders and
-- order_items from recursing into each other. None of that exists in MySQL —
-- there's no database-level RLS at all — so the same visibility rules become
-- plain WHERE clauses in the Express backend, with no recursion risk since
-- it's ordinary application code, not a database security layer:
--
--   Buyer's own orders:
--     SELECT * FROM orders WHERE buyer_id = :userId
--
--   Seller's incoming orders (orders containing at least one of their items):
--     SELECT DISTINCT o.* FROM orders o
--     JOIN order_items oi ON oi.order_id = o.id
--     WHERE oi.seller_id = :userId
--
--   A seller may only UPDATE/DELETE an order if that same join finds a row
--   for them; a buyer may only INSERT an order as themselves (buyer_id must
--   equal req.user.id, checked in the handler, not the database).

CREATE TABLE IF NOT EXISTS orders (

  id                 CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  -- The user who placed the order.
  buyer_id           CHAR(36),

  -- Customer details captured at checkout time.
  customer_name      VARCHAR(255) NOT NULL,
  customer_address   VARCHAR(500) NOT NULL,
  customer_district  VARCHAR(100) NOT NULL,
  customer_phone     VARCHAR(50)  NOT NULL,
  customer_email     VARCHAR(255) NOT NULL,
  customer_note      TEXT,

  -- Shipping choice: 'inside' | 'suburbs' | 'outside'
  shipping_method    VARCHAR(20) NOT NULL DEFAULT 'inside',
  shipping_fee       DECIMAL(10, 2) NOT NULL,
  subtotal           DECIMAL(12, 2) NOT NULL,
  total              DECIMAL(12, 2) NOT NULL,

  -- Order lifecycle: 'pending' | 'confirmed' | 'delivered' | 'cancelled'
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',

  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE SET NULL

) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS order_items (

  id            CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  -- Parent order.
  order_id      CHAR(36) NOT NULL,

  -- The marketplace listing that was purchased.
  listing_id    CHAR(36),

  -- The seller who owns that listing — denormalised here so the backend can
  -- filter "my incoming orders" without joining through marketplace_items.
  seller_id     CHAR(36) NOT NULL,

  -- Snapshot of the listing at purchase time (title/price can change later).
  title         VARCHAR(255) NOT NULL,
  price         DECIMAL(12, 2) NOT NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  item_subtotal DECIMAL(12, 2) NOT NULL,

  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders(id)            ON DELETE CASCADE,
  CONSTRAINT fk_items_listing FOREIGN KEY (listing_id) REFERENCES marketplace_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_items_seller  FOREIGN KEY (seller_id)  REFERENCES users(id)             ON DELETE CASCADE

) ENGINE=InnoDB;


-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_orders_buyer_id    ON orders(buyer_id);
CREATE INDEX idx_order_items_order  ON order_items(order_id);
CREATE INDEX idx_order_items_seller ON order_items(seller_id);
