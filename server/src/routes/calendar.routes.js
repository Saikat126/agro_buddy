const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { randomUUID } = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const EVENT_TYPES = ['vet', 'harvest', 'market', 'medication', 'other'];

function validate(data) {
  const errors = {};
  if (!data.title || !data.title.trim()) errors.title = 'Event title is required.';
  if (!data.event_date) {
    errors.event_date = 'Event date is required.';
  } else if (isNaN(Date.parse(data.event_date))) {
    errors.event_date = 'Event date must be a valid date (YYYY-MM-DD).';
  }
  if (data.event_type && !EVENT_TYPES.includes(data.event_type)) {
    errors.event_type = `Event type must be one of: ${EVENT_TYPES.join(', ')}.`;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

// GET /api/calendar?year=&month=&type=&animal_id=
router.get('/', asyncHandler(async (req, res) => {
  let sql = 'SELECT * FROM calendar_events WHERE user_id = ?';
  const params = [req.userId];

  if (req.query.animal_id) {
    sql += ' AND animal_id = ?';
    params.push(req.query.animal_id);
  }

  if (req.query.year && req.query.month) {
    const mm = String(req.query.month).padStart(2, '0');
    const startDate = `${req.query.year}-${mm}-01`;
    const lastDay = new Date(Number(req.query.year), Number(req.query.month), 0).getDate();
    const endDate = `${req.query.year}-${mm}-${String(lastDay).padStart(2, '0')}`;
    sql += ' AND event_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  if (req.query.type) {
    if (!EVENT_TYPES.includes(req.query.type)) {
      return res.status(400).json({ error: `Invalid event type: "${req.query.type}".` });
    }
    sql += ' AND event_type = ?';
    params.push(req.query.type);
  }

  sql += ' ORDER BY event_date ASC';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// POST /api/calendar
router.post('/', asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { title, event_date, event_type, notes, animal_id } = req.body;
  const id = randomUUID();
  await pool.query(
    `INSERT INTO calendar_events (id, user_id, title, event_date, event_type, notes, completed, animal_id)
     VALUES (?, ?, ?, ?, ?, ?, FALSE, ?)`,
    [id, req.userId, title.trim(), event_date, event_type || 'other', notes || null, animal_id || null]
  );
  const [rows] = await pool.query('SELECT * FROM calendar_events WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

// PUT /api/calendar/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { title, event_date, event_type, notes, animal_id } = req.body;
  const [result] = await pool.query(
    `UPDATE calendar_events SET title = ?, event_date = ?, event_type = ?, notes = ?, animal_id = ?
     WHERE id = ? AND user_id = ?`,
    [title.trim(), event_date, event_type || 'other', notes || null, animal_id || null, req.params.id, req.userId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Event not found.' });
  const [rows] = await pool.query('SELECT * FROM calendar_events WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

// PATCH /api/calendar/:id/complete
router.patch('/:id/complete', asyncHandler(async (req, res) => {
  const [result] = await pool.query(
    'UPDATE calendar_events SET completed = ? WHERE id = ? AND user_id = ?',
    [!!req.body.completed, req.params.id, req.userId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Event not found.' });
  const [rows] = await pool.query('SELECT * FROM calendar_events WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

// DELETE /api/calendar/past — deletes all of the caller's events whose date has passed.
// Must come before /:id so Express doesn't treat "past" as an :id value.
router.delete('/past', asyncHandler(async (req, res) => {
  await pool.query(
    'DELETE FROM calendar_events WHERE user_id = ? AND event_date < CURRENT_DATE()',
    [req.userId]
  );
  res.status(204).end();
}));

// DELETE /api/calendar/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM calendar_events WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Event not found.' });
  res.status(204).end();
}));

module.exports = router;
