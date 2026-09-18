const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { randomUUID } = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function validate(data) {
  const errors = {};
  if (!data.name || !data.name.trim()) errors.name = 'Vet name is required.';
  if (data.phone) {
    const digits = data.phone.replace(/\D/g, '');
    if (digits.length < 7) errors.phone = 'Phone number must contain at least 7 digits.';
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (data.rating !== undefined && data.rating !== null && data.rating !== '') {
    const r = Number(data.rating);
    if (isNaN(r) || r < 0 || r > 5) errors.rating = 'Rating must be a number between 0 and 5.';
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

// GET /api/vets?search=&location=&available=true
// Visibility mirrors the old RLS rule: public vets + the caller's own private ones.
router.get('/', asyncHandler(async (req, res) => {
  let sql = 'SELECT * FROM vets WHERE (is_public = TRUE OR user_id = ?)';
  const params = [req.userId];

  if (req.query.search && req.query.search.trim()) {
    const term = `%${req.query.search.trim()}%`;
    sql += ' AND (name LIKE ? OR specialty LIKE ? OR clinic LIKE ? OR location LIKE ?)';
    params.push(term, term, term, term);
  }
  if (req.query.location && req.query.location.trim()) {
    sql += ' AND location LIKE ?';
    params.push(`%${req.query.location.trim()}%`);
  }
  if (req.query.available === 'true') {
    sql += ' AND available = TRUE';
  }

  sql += req.query.available === 'true' ? ' ORDER BY rating DESC' : ' ORDER BY name ASC';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// POST /api/vets
router.post('/', asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { name, specialty, clinic, phone, email, location, map_link, rating, available, is_public } = req.body;
  const id = randomUUID();
  await pool.query(
    `INSERT INTO vets (id, user_id, name, specialty, clinic, phone, email, location, map_link, rating, available, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.userId, name.trim(), specialty || null, clinic || null, phone || null, email?.trim() || null,
     location || null, map_link || null, rating != null ? Number(rating) : null,
     available !== undefined ? !!available : true, is_public !== undefined ? !!is_public : true]
  );
  const [rows] = await pool.query('SELECT * FROM vets WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

// PUT /api/vets/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { name, specialty, clinic, phone, email, location, map_link, rating, available, is_public } = req.body;
  const [result] = await pool.query(
    `UPDATE vets SET name = ?, specialty = ?, clinic = ?, phone = ?, email = ?, location = ?, map_link = ?, rating = ?, available = ?, is_public = ?
     WHERE id = ? AND user_id = ?`,
    [name.trim(), specialty || null, clinic || null, phone || null, email?.trim() || null, location || null,
     map_link || null, rating != null ? Number(rating) : null, !!available, !!is_public, req.params.id, req.userId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Vet not found.' });
  const [rows] = await pool.query('SELECT * FROM vets WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

// PATCH /api/vets/:id/availability
router.patch('/:id/availability', asyncHandler(async (req, res) => {
  const [result] = await pool.query(
    'UPDATE vets SET available = ? WHERE id = ? AND user_id = ?',
    [!!req.body.available, req.params.id, req.userId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Vet not found.' });
  const [rows] = await pool.query('SELECT * FROM vets WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

// DELETE /api/vets/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM vets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Vet not found.' });
  res.status(204).end();
}));

module.exports = router;
