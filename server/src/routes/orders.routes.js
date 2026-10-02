const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { randomUUID } = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const STANDARD_SHIPPING_FEE = 65;

// Delivery is free only when every seller represented in the cart is in the
// same district as the buyer's delivery address — mirrors Checkout.jsx's
// preview, but recomputed here from the DB so a tampered client request
// can't just claim free shipping.
async function computeShippingFee(cart, buyerDistrict) {
  const sellerIds = [...new Set(cart.map((item) => item.user_id))];
  const [rows] = await pool.query('SELECT id, district FROM users WHERE id IN (?)', [sellerIds]);
  const district = (buyerDistrict || '').trim().toLowerCase();
  const allSameCity = district && rows.length > 0 && rows.every(
    (seller) => (seller.district || '').trim().toLowerCase() === district
  );
  return allSameCity ? 0 : STANDARD_SHIPPING_FEE;
}

// POST /api/orders — creates the order header, then one order_item per cart entry,
// all inside a transaction so a failure partway through leaves nothing behind.
router.post('/', asyncHandler(async (req, res) => {
  const { billing, shipping, cart } = req.body;
  if (!billing || !shipping || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Missing billing, shipping, or cart details.' });
  }

  const paymentMethod = shipping.paymentMethod || 'cod';
  if (!['cod', 'online'].includes(paymentMethod)) {
    return res.status(400).json({ error: `Invalid payment method: "${paymentMethod}".` });
  }

  const subtotal = cart.reduce((s, item) => s + Number(item.price) * item.quantity, 0);
  const shippingFee = await computeShippingFee(cart, billing.district);
  const total = subtotal + shippingFee;
  const orderId = randomUUID();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO orders
         (id, buyer_id, customer_name, customer_address, customer_district, customer_phone,
          customer_email, customer_note, shipping_method, shipping_fee, subtotal, total, status, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [orderId, req.userId, billing.fullName.trim(), billing.address.trim(), billing.district.trim(),
       billing.phone.trim(), billing.email.trim(), billing.note?.trim() || null, shipping.method,
       shippingFee, Number(subtotal.toFixed(2)), Number(total.toFixed(2)), paymentMethod]
    );

    for (const item of cart) {
      await conn.query(
        `INSERT INTO order_items (id, order_id, listing_id, seller_id, title, price, quantity, item_subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), orderId, item.id, item.user_id, item.title, Number(item.price).toFixed(2),
         item.quantity, (Number(item.price) * item.quantity).toFixed(2)]
      );
    }

    await conn.commit();
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Could not place order.' });
  } finally {
    conn.release();
  }
}));

// GET /api/orders/seller — orders containing at least one of the caller's listings,
// grouped by order (mirrors fetchSellerOrders' shape: [{ order, items }]).
// Reads from the seller_order_items view (see src/db/09_views.sql) — a plain
// join with no aggregation, so MySQL merges it into this query and pushes
// "WHERE seller_id = ?" down normally, same cost as writing the join by hand.
router.get('/seller', asyncHandler(async (req, res) => {
  const [itemRows] = await pool.query(
    'SELECT * FROM seller_order_items WHERE seller_id = ? ORDER BY order_created_at DESC',
    [req.userId]
  );

  const grouped = {};
  for (const row of itemRows) {
    if (!grouped[row.order_id]) {
      grouped[row.order_id] = {
        order: {
          id: row.o_id, customer_name: row.customer_name, customer_address: row.customer_address,
          customer_district: row.customer_district, customer_phone: row.customer_phone,
          customer_email: row.customer_email, customer_note: row.customer_note,
          shipping_method: row.shipping_method, shipping_fee: row.shipping_fee,
          subtotal: row.subtotal, total: row.total, status: row.status,
          payment_method: row.payment_method, payment_status: row.payment_status,
          created_at: row.order_created_at,
        },
        items: [],
      };
    }
    grouped[row.order_id].items.push({
      id: row.id, listing_id: row.listing_id, title: row.title,
      price: row.price, quantity: row.quantity, item_subtotal: row.item_subtotal,
    });
  }

  res.json(Object.values(grouped));
}));

// GET /api/orders/buyer — the caller's own orders (buyer view), each with its items.
router.get('/buyer', asyncHandler(async (req, res) => {
  const [orders] = await pool.query(
    `SELECT id, customer_name, customer_address, customer_district,
            shipping_method, shipping_fee, subtotal, total, status,
            payment_method, payment_status, created_at
     FROM orders WHERE buyer_id = ? ORDER BY created_at DESC`,
    [req.userId]
  );
  if (orders.length === 0) return res.json([]);

  const [items] = await pool.query(
    `SELECT oi.*, u.full_name AS seller_name
     FROM order_items oi
     JOIN users u ON u.id = oi.seller_id
     WHERE oi.order_id IN (?)`,
    [orders.map((o) => o.id)]
  );
  const byOrder = {};
  for (const item of items) {
    (byOrder[item.order_id] ??= []).push({
      id: item.id, title: item.title, price: item.price, quantity: item.quantity,
      item_subtotal: item.item_subtotal, seller_name: item.seller_name,
    });
  }
  res.json(orders.map((o) => ({ ...o, order_items: byOrder[o.id] || [] })));
}));

// Every order the caller (as a seller) is allowed to touch below must have at
// least one order_item with seller_id = them — this replaces the old
// seller_has_items_in_order() RLS helper.
async function isSellerOfOrder(orderId, userId) {
  const [rows] = await pool.query(
    'SELECT 1 FROM order_items WHERE order_id = ? AND seller_id = ? LIMIT 1',
    [orderId, userId]
  );
  return rows.length > 0;
}

// PATCH /api/orders/:id/status — moves an order forward through
// pending → confirmed → delivered, or sideways to cancelled (see
// Marketplace.jsx's handleOrderStatusChange — all of these persist a status
// rather than deleting the row, which is what lets a cancelled/delivered
// order still show up, and later be removed, in the buyer's own history).
// Nothing here is destructive on its own, except cancelling specifically —
// that's still blocked for a paid order, same reasoning as the delete guard
// below: cancelling it would misrepresent what happened without a refund.
router.patch('/:id/status', asyncHandler(async (req, res) => {
  if (!await isSellerOfOrder(req.params.id, req.userId)) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  if (req.body.status === 'cancelled') {
    const [[order] = []] = await pool.query('SELECT payment_status FROM orders WHERE id = ?', [req.params.id]);
    if (order?.payment_status === 'paid') {
      return res.status(409).json({ error: 'This order was paid online — refund it before cancelling.' });
    }
  }
  await pool.query('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

// DELETE /api/orders/:id — cascades to remove its order_items too. This is
// the seller's "Remove" action, only ever used on an order already in a
// terminal state (delivered/cancelled — enforced by the button's own
// visibility in Marketplace.jsx), where the transaction is fully resolved.
// The guard below is still kept as defense-in-depth in case this is ever
// reached on a still-active paid order some other way.
// (Issuing an actual SSLCommerz refund is a separate, not-yet-built feature.)
router.delete('/:id', asyncHandler(async (req, res) => {
  if (!await isSellerOfOrder(req.params.id, req.userId)) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  const [[order] = []] = await pool.query('SELECT status, payment_status FROM orders WHERE id = ?', [req.params.id]);
  if (order?.payment_status === 'paid' && order.status !== 'delivered') {
    return res.status(409).json({ error: 'This order was paid online — refund it before cancelling.' });
  }
  await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

// DELETE /api/orders/:id/mine — lets a buyer clear one of their own orders
// out of "My Orders", but only once it's reached a terminal state (delivered
// or cancelled). A still-active order (pending/confirmed) can only be
// touched by the seller via the route above — a buyer can't make it vanish
// out from under a seller who's still fulfilling it.
router.delete('/:id/mine', asyncHandler(async (req, res) => {
  const [[order] = []] = await pool.query(
    'SELECT status FROM orders WHERE id = ? AND buyer_id = ?', [req.params.id, req.userId]
  );
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (!['delivered', 'cancelled'].includes(order.status)) {
    return res.status(409).json({ error: 'Only delivered or cancelled orders can be removed.' });
  }
  await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
