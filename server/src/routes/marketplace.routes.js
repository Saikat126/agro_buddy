const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { randomUUID } = require('crypto');
const pool = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['Livestock', 'Crops', 'Equipment', 'Supplies', 'Other'];

function validate(data) {
  const errors = {};
  if (!data.title || !data.title.trim()) errors.title = 'Listing title is required.';
  if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
    errors.category = `Category must be one of: ${VALID_CATEGORIES.join(', ')}.`;
  }
  if (data.price === undefined || data.price === null || data.price === '') {
    errors.price = 'Price is required.';
  } else if (isNaN(Number(data.price)) || Number(data.price) <= 0) {
    errors.price = 'Price must be a positive number.';
  }
  if (!data.unit || !data.unit.trim()) errors.unit = 'Unit is required (e.g., "per head", "per kg").';
  if (!data.seller_name || !data.seller_name.trim()) errors.seller_name = 'Seller name is required.';
  return Object.keys(errors).length > 0 ? errors : null;
}

// GET /api/marketplace — public: only available listings, optionally filtered by category.
// No auth required, matching the old "Anyone can view available listings" policy.
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  let sql = 'SELECT * FROM marketplace_items WHERE available = TRUE';
  const params = [];
  if (req.query.category) {
    if (!VALID_CATEGORIES.includes(req.query.category)) {
      return res.status(400).json({ error: `Invalid category: "${req.query.category}".` });
    }
    sql += ' AND category = ?';
    params.push(req.query.category);
  }
  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// GET /api/marketplace/mine — the caller's own listings, including hidden ones.
router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM marketplace_items WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId]
  );
  res.json(rows);
}));

// POST /api/marketplace
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { title, category, price, unit, seller_name, description, image_url } = req.body;
  const id = randomUUID();
  await pool.query(
    `INSERT INTO marketplace_items (id, user_id, title, category, price, unit, seller_name, description, image_url, available)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
    [id, req.userId, title.trim(), category, Number(price), unit.trim(), seller_name.trim(), description || null, image_url || null]
  );
  const [rows] = await pool.query('SELECT * FROM marketplace_items WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

// PUT /api/marketplace/:id
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { title, category, price, unit, seller_name, description, image_url } = req.body;
  const [result] = await pool.query(
    `UPDATE marketplace_items SET title = ?, category = ?, price = ?, unit = ?, seller_name = ?, description = ?, image_url = ?
     WHERE id = ? AND user_id = ?`,
    [title.trim(), category, Number(price), unit.trim(), seller_name.trim(), description || null, image_url || null, req.params.id, req.userId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Listing not found.' });
  const [rows] = await pool.query('SELECT * FROM marketplace_items WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

// PATCH /api/marketplace/:id/availability
router.patch('/:id/availability', requireAuth, asyncHandler(async (req, res) => {
  const [result] = await pool.query(
    'UPDATE marketplace_items SET available = ? WHERE id = ? AND user_id = ?',
    [!!req.body.available, req.params.id, req.userId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Listing not found.' });
  const [rows] = await pool.query('SELECT * FROM marketplace_items WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

// DELETE /api/marketplace/:id
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM marketplace_items WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Listing not found.' });
  res.status(204).end();
}));

module.exports = router;
