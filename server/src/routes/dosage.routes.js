const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { randomUUID } = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function computeEndDate(startDate, durationDays) {
  const start = new Date(startDate);
  start.setDate(start.getDate() + Number(durationDays));
  return start.toISOString().split('T')[0];
}

function validate(record) {
  const errors = {};
  if (!record.animal_name || !record.animal_name.trim()) errors.animal_name = 'Animal name is required.';
  if (!record.medication || !record.medication.trim()) errors.medication = 'Medication name is required.';
  if (!record.weight_kg || Number(record.weight_kg) <= 0) errors.weight_kg = 'Animal weight must be greater than zero.';
  if (!record.dose_per_kg || Number(record.dose_per_kg) <= 0) errors.dose_per_kg = 'Dose per kg must be greater than zero.';
  if (!record.concentration || Number(record.concentration) <= 0) errors.concentration = 'Concentration must be greater than zero.';
  if (!record.frequency_days || Number(record.frequency_days) < 1) errors.frequency_days = 'Frequency must be at least 1 day.';
  if (!record.duration_days || Number(record.duration_days) < 1) errors.duration_days = 'Duration must be at least 1 day.';
  if (!record.start_date || isNaN(Date.parse(record.start_date))) errors.start_date = 'A valid start date is required.';
  return Object.keys(errors).length > 0 ? errors : null;
}

// GET /api/dosage?animal_id=&active=true
router.get('/', asyncHandler(async (req, res) => {
  let sql = 'SELECT * FROM dosage_records WHERE user_id = ?';
  const params = [req.userId];

  if (req.query.animal_id) {
    sql += ' AND animal_id = ?';
    params.push(req.query.animal_id);
    sql += ' ORDER BY start_date DESC';
  } else if (req.query.active === 'true') {
    sql += ' AND start_date <= CURRENT_DATE() AND end_date >= CURRENT_DATE()';
    sql += ' ORDER BY end_date ASC';
  } else {
    sql += ' ORDER BY created_at DESC';
  }

  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// POST /api/dosage
router.post('/', asyncHandler(async (req, res) => {
  const errors = validate(req.body);
  if (errors) return res.status(400).json({ error: JSON.stringify(errors) });

  const { animal_id, animal_name, medication, weight_kg, dose_per_kg, concentration,
          total_mg, total_ml, frequency_days, duration_days, start_date, notes } = req.body;
  const endDate = computeEndDate(start_date, duration_days);
  const id = randomUUID();

  await pool.query(
    `INSERT INTO dosage_records
       (id, user_id, animal_id, animal_name, medication, weight_kg, dose_per_kg, concentration,
        total_mg, total_ml, frequency_days, duration_days, start_date, end_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.userId, animal_id || null, animal_name.trim(), medication.trim(),
     Number(weight_kg), Number(dose_per_kg), Number(concentration), Number(total_mg), Number(total_ml),
     Number(frequency_days), Number(duration_days), start_date, endDate, notes || null]
  );
  const [rows] = await pool.query('SELECT * FROM dosage_records WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
}));

// DELETE /api/dosage/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM dosage_records WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found.' });
  res.status(204).end();
}));

module.exports = router;
