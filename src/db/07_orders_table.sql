

CREATE TABLE IF NOT EXISTS orders (

  id                 CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  buyer_id           CHAR(36),

  customer_name      VARCHAR(255) NOT NULL,
  customer_address   VARCHAR(500) NOT NULL,
  customer_district  VARCHAR(100) NOT NULL,
  customer_phone     VARCHAR(50)  NOT NULL,
  customer_email     VARCHAR(255) NOT NULL,
  customer_note      TEXT,

  shipping_method    VARCHAR(20) NOT NULL DEFAULT 'inside',
  shipping_fee       DECIMAL(10, 2) NOT NULL,
  subtotal           DECIMAL(12, 2) NOT NULL,
  total              DECIMAL(12, 2) NOT NULL,

  status             VARCHAR(20) NOT NULL DEFAULT 'pending',

  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE SET NULL

) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS order_items (

  id            CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  order_id      CHAR(36) NOT NULL,

  listing_id    CHAR(36),

  seller_id     CHAR(36) NOT NULL,

  title         VARCHAR(255) NOT NULL,
  price         DECIMAL(12, 2) NOT NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  item_subtotal DECIMAL(12, 2) NOT NULL,

  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders(id)            ON DELETE CASCADE,
  CONSTRAINT fk_items_listing FOREIGN KEY (listing_id) REFERENCES marketplace_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_items_seller  FOREIGN KEY (seller_id)  REFERENCES users(id)             ON DELETE CASCADE

) ENGINE=InnoDB;


-- Buyer order history: "WHERE buyer_id = ? ORDER BY created_at DESC".
CREATE INDEX idx_orders_buyer_created     ON orders(buyer_id, created_at);

-- Covers both order_items lookups: the buyer view's "WHERE order_id IN (...)"
-- (leftmost prefix) and the seller-ownership check "WHERE order_id = ? AND
-- seller_id = ?" used on every PATCH/DELETE of an order (both columns).
CREATE INDEX idx_order_items_order_seller ON order_items(order_id, seller_id);

-- Seller's incoming orders: "WHERE seller_id = ?" (joined into orders).
CREATE INDEX idx_order_items_seller       ON order_items(seller_id);
