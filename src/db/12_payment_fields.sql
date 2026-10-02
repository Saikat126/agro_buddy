-- ─── 12_payment_fields.sql ──────────────────────────────────────────────────
-- Adds online-payment tracking (SSLCommerz) to orders. Purely additive:
-- existing rows default to payment_method='cod', payment_status='unpaid',
-- so the cash-on-delivery flow keeps working exactly as before.

ALTER TABLE orders
  ADD COLUMN payment_method VARCHAR(10) NOT NULL DEFAULT 'cod'
    CHECK (payment_method IN ('cod', 'online')),
  ADD COLUMN payment_status VARCHAR(10) NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'failed')),
  ADD COLUMN transaction_id VARCHAR(100),
  ADD COLUMN val_id         VARCHAR(100),
  ADD COLUMN paid_at        TIMESTAMP NULL;

-- Looked up by POST /api/payments/initiate and the ipn/success/fail handlers
-- to resolve a gateway callback back to its order.
CREATE INDEX idx_orders_transaction_id ON orders(transaction_id);

-- seller_order_items (src/db/09_views.sql) lists orders columns explicitly
-- rather than o.*, so it has to be reissued to expose the new ones —
-- otherwise GET /api/orders/seller would never see payment_method/payment_status.
CREATE OR REPLACE VIEW seller_order_items AS
SELECT
  oi.id, oi.order_id, oi.listing_id, oi.seller_id,
  oi.title, oi.price, oi.quantity, oi.item_subtotal,
  o.id AS o_id, o.customer_name, o.customer_address, o.customer_district,
  o.customer_phone, o.customer_email, o.customer_note,
  o.shipping_method, o.shipping_fee, o.subtotal, o.total, o.status,
  o.payment_method, o.payment_status,
  o.created_at AS order_created_at
FROM order_items oi
JOIN orders o ON o.id = oi.order_id;
