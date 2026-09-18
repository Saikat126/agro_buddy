const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { randomUUID } = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/orders — creates the order header, then one order_item per cart entry,
// all inside a transaction so a failure partway through leaves nothing behind.
router.post('/', asyncHandler(async (req, res) => {
  const { billing, shipping, cart } = req.body;
  if (!billing || !shipping || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Missing billing, shipping, or cart details.' });
  }

  const subtotal = cart.reduce((s, item) => s + Number(item.price) * item.quantity, 0);
  const total = subtotal + Number(shipping.fee);
  const orderId = randomUUID();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO orders
         (id, buyer_id, customer_name, customer_address, customer_district, customer_phone,
          customer_email, customer_note, shipping_method, shipping_fee, subtotal, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [orderId, req.userId, billing.fullName.trim(), billing.address.trim(), billing.district.trim(),
       billing.phone.trim(), billing.email.trim(), billing.note?.trim() || null, shipping.method,
       Number(shipping.fee), Number(subtotal.toFixed(2)), Number(total.toFixed(2))]
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
router.get('/seller', asyncHandler(async (req, res) => {
  const [itemRows] = await pool.query(
    `SELECT oi.*, o.id AS o_id, o.customer_name, o.customer_address, o.customer_district,
            o.customer_phone, o.customer_email, o.customer_note, o.shipping_method,
            o.shipping_fee, o.subtotal, o.total, o.status, o.created_at AS order_created_at
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.seller_id = ?
     ORDER BY o.created_at DESC`,
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
          subtotal: row.subtotal, total: row.total, status: row.status, created_at: row.order_created_at,
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
            shipping_method, shipping_fee, subtotal, total, status, created_at
     FROM orders WHERE buyer_id = ? ORDER BY created_at DESC`,
    [req.userId]
  );
  if (orders.length === 0) return res.json([]);

  const [items] = await pool.query(
    `SELECT * FROM order_items WHERE order_id IN (?)`,
    [orders.map((o) => o.id)]
  );
  const byOrder = {};
  for (const item of items) {
    (byOrder[item.order_id] ??= []).push({
      id: item.id, title: item.title, price: item.price, quantity: item.quantity, item_subtotal: item.item_subtotal,
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

// PATCH /api/orders/:id/status
router.patch('/:id/status', asyncHandler(async (req, res) => {
  if (!await isSellerOfOrder(req.params.id, req.userId)) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  await pool.query('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

// DELETE /api/orders/:id — cascades to remove its order_items too.
router.delete('/:id', asyncHandler(async (req, res) => {
  if (!await isSellerOfOrder(req.params.id, req.userId)) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
