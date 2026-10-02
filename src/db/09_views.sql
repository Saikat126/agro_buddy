-- ─── 09_views.sql ──────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW animal_health_summary AS
SELECT
  a.id, a.user_id, a.name, a.species, a.breed, a.age_years, a.weight_kg,
  a.notes, a.image_url, a.created_at,
  COUNT(DISTINCT d.id) AS dosage_record_count,
  MAX(d.end_date) AS latest_treatment_end,
  COUNT(DISTINCT CASE WHEN c.completed = FALSE THEN c.id END) AS upcoming_event_count,
  COUNT(DISTINCT CASE WHEN t.completed = FALSE THEN t.id END) AS open_task_count
FROM animals a
LEFT JOIN dosage_records d  ON d.animal_id = a.id
LEFT JOIN calendar_events c ON c.animal_id = a.id
LEFT JOIN tasks t           ON t.animal_id = a.id
GROUP BY a.id;

-- ── listing_performance ──────────────────────────────────────────────────────
-- seller_name here is mi.seller_name — the name the seller actually put on
-- the listing (which may deliberately differ from their account's full_name,
-- e.g. a farm/business name) — not users.full_name, so this always agrees
-- with what GET /api/marketplace shows for the same listing.
CREATE OR REPLACE VIEW listing_performance AS
SELECT
  mi.id, mi.user_id, mi.title, mi.category, mi.price, mi.available, mi.created_at,
  mi.seller_name,
  COUNT(DISTINCT oi.id) AS times_ordered,
  COALESCE(SUM(oi.quantity), 0) AS total_quantity_sold,
  COALESCE(SUM(oi.item_subtotal), 0) AS total_revenue
FROM order_items oi
JOIN orders o                   ON o.id = oi.order_id
RIGHT JOIN marketplace_items mi ON mi.id = oi.listing_id
GROUP BY mi.id, mi.user_id, mi.title, mi.category, mi.price, mi.available, mi.created_at, mi.seller_name;

-- ── seller_order_items ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW seller_order_items AS
SELECT
  oi.id, oi.order_id, oi.listing_id, oi.seller_id,
  oi.title, oi.price, oi.quantity, oi.item_subtotal,
  o.id AS o_id, o.customer_name, o.customer_address, o.customer_district,
  o.customer_phone, o.customer_email, o.customer_note,
  o.shipping_method, o.shipping_fee, o.subtotal, o.total, o.status,
  o.created_at AS order_created_at
FROM order_items oi
JOIN orders o ON o.id = oi.order_id;
