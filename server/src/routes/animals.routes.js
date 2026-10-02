const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { randomUUID } = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function validate(data) {
  const errors = {};
  if (!data.name || !data.name.trim()) errors.name = 'Animal name is required.';
  if (!data.species || !data.species.trim()) errors.species = 'Species is required (e.g., Cattle, Goat, Chicken).';
  if (data.age_years !== undefined && data.age_years !== null && data.age_years !== '') {
    const age = Number(data.age_years);
    if (isNaN(age) || age < 0) errors.age_years = 'Age must be a positive number (e.g., 1.5 for 18 months).';
  }
  if (data.weight_kg !== undefined && data.weight_kg !== null && data.weight_kg !== '') {
    const weight = Number(data.weight_kg);
    if (isNaN(weight) || weight <= 0) errors.weight_kg = 'Weight must be greater than zero.';
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

// GET /api/animals — all of the caller's own animals, newest first.
router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM animals WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId]
  );
  res.json(rows);
}));

// GET /api/animals/:id — one animal's full details plus counts of its related
// records (dosage history, upcoming events, open tasks), from the
// animal_health_summary view (see src/db/09_views.sql) — a LEFT JOIN across
// animals, dosage_records, calendar_events, and tasks so an animal with zero
// related records still comes back with 0 counts instead of a missing row.
router.get('/:id', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM animal_health_summary WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Animal not found.' });
  res.json(rows[0]);
}));

// POST /api/animals
router.post('/', asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { name, species, age_years, weight_kg, notes, image_url } = req.body;
  const id = randomUUID();
  await pool.query(
    `INSERT INTO animals (id, user_id, name, species, age_years, weight_kg, notes, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.userId, name.trim(), species.trim(), age_years || null, weight_kg || null, notes || null, image_url || null]
  );
  const [rows] = await pool.query('SELECT * FROM animals WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

// PUT /api/animals/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { name, species, age_years, weight_kg, notes, image_url } = req.body;
  const [result] = await pool.query(
    `UPDATE animals SET name = ?, species = ?, age_years = ?, weight_kg = ?, notes = ?, image_url = ?
     WHERE id = ? AND user_id = ?`,
    [name.trim(), species.trim(), age_years || null, weight_kg || null, notes || null, image_url || null, req.params.id, req.userId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Animal not found.' });

  const [rows] = await pool.query('SELECT * FROM animals WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

// DELETE /api/animals/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM animals WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Animal not found.' });
  res.status(204).end();
}));

module.exports = router;
