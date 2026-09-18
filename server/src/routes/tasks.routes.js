const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { randomUUID } = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function validate(data) {
  const errors = {};
  if (!data.title || !data.title.trim()) errors.title = 'Task title is required.';
  if (data.dueDate || data.due_date) {
    const raw = data.dueDate || data.due_date;
    if (isNaN(Date.parse(raw))) errors.dueDate = 'Due date must be a valid date (YYYY-MM-DD).';
  }
  const allowed = ['low', 'medium', 'high'];
  if (data.priority && !allowed.includes(data.priority.toLowerCase())) {
    errors.priority = `Priority must be 'low', 'medium', or 'high'.`;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

function normalize(row) {
  return {
    id: row.id, userId: row.user_id, title: row.title, dueDate: row.due_date,
    priority: row.priority, completed: !!row.completed, isRepeating: !!row.is_repeating,
    animalId: row.animal_id, notes: row.notes, createdAt: row.created_at,
  };
}

// GET /api/tasks?completed=true|false
router.get('/', asyncHandler(async (req, res) => {
  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [req.userId];
  if (req.query.completed === 'true' || req.query.completed === 'false') {
    sql += ' AND completed = ?';
    params.push(req.query.completed === 'true' ? 1 : 0);
  }
  sql += ' ORDER BY (due_date IS NULL), due_date ASC';
  const [rows] = await pool.query(sql, params);
  res.json(rows.map(normalize));
}));

// POST /api/tasks
router.post('/', asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { title, dueDate, due_date, priority, isRepeating, animalId, animal_id, notes } = req.body;
  const id = randomUUID();
  await pool.query(
    `INSERT INTO tasks (id, user_id, title, due_date, priority, completed, is_repeating, animal_id, notes)
     VALUES (?, ?, ?, ?, ?, FALSE, ?, ?, ?)`,
    [id, req.userId, title.trim(), dueDate || due_date || null, (priority || 'medium').toLowerCase(),
     !!isRepeating, animalId || animal_id || null, notes || null]
  );
  const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
  res.status(201).json(normalize(rows[0]));
}));

// PATCH /api/tasks/:id/complete
router.patch('/:id/complete', asyncHandler(async (req, res) => {
  const [result] = await pool.query(
    'UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?',
    [!!req.body.completed, req.params.id, req.userId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found.' });
  const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  res.json(normalize(rows[0]));
}));

// PUT /api/tasks/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { title, dueDate, due_date, priority, animalId, animal_id, notes } = req.body;
  const [result] = await pool.query(
    `UPDATE tasks SET title = ?, due_date = ?, priority = ?, animal_id = ?, notes = ?
     WHERE id = ? AND user_id = ?`,
    [title.trim(), dueDate || due_date || null, priority?.toLowerCase() || 'medium',
     animalId || animal_id || null, notes || null, req.params.id, req.userId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found.' });
  const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  res.json(normalize(rows[0]));
}));

// DELETE /api/tasks/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found.' });
  res.status(204).end();
}));

module.exports = router;
