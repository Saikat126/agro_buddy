const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { randomUUID } = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// duration_days counts the start date itself, so a 2-day treatment starting
// today ends tomorrow (today + 1), not the day after — matches doseSchedule().
function computeEndDate(startDate, durationDays) {
  const start = new Date(startDate);
  start.setDate(start.getDate() + Number(durationDays) - 1);
  return start.toISOString().split('T')[0];
}

// Computes the same total_mg/total_ml the frontend's live preview shows, so
// the saved record can never drift from what weight/dose/concentration imply
// — the client's own numbers are only ever used for that preview, never trusted on save.
function computeDose(weightKg, dosePerKg, concentration) {
  const totalMg = Number(weightKg) * Number(dosePerKg);
  const totalMl = totalMg / Number(concentration);
  return { totalMg: parseFloat(totalMg.toFixed(4)), totalMl: parseFloat(totalMl.toFixed(4)) };
}

function validate(record) {
  const errors = {};
  // animal_name is only required free-text when no animal profile is linked —
  // when animal_id is set, the name is always derived server-side from it (see POST /).
  if (!record.animal_id && (!record.animal_name || !record.animal_name.trim())) {
    errors.animal_name = 'Animal name is required.';
  }
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

  const { animal_id, medication, weight_kg, dose_per_kg, concentration,
          frequency_days, duration_days, start_date, notes } = req.body;

  // animal_name is never trusted from the client when an animal is linked —
  // it's always the linked animal's actual current name, so the two columns
  // can never drift apart (that drift was a real bug once already: a record
  // could display one name while being joined/queried under a different id).
  // Looking it up also doubles as an ownership check on animal_id.
  let animal_name = req.body.animal_name;
  if (animal_id) {
    const [[animal] = []] = await pool.query(
      'SELECT name FROM animals WHERE id = ? AND user_id = ?', [animal_id, req.userId]
    );
    if (!animal) return res.status(400).json({ error: JSON.stringify({ animal_id: 'Animal not found.' }) });
    animal_name = animal.name;
  }

  // total_mg/total_ml are likewise computed here rather than trusted from the
  // client, so a saved record can never disagree with its own weight/dose/
  // concentration — the frontend's own math is only ever a live preview.
  const { totalMg, totalMl } = computeDose(weight_kg, dose_per_kg, concentration);
  const endDate = computeEndDate(start_date, duration_days);
  const id = randomUUID();

  await pool.query(
    `INSERT INTO dosage_records
       (id, user_id, animal_id, animal_name, medication, weight_kg, dose_per_kg, concentration,
        total_mg, total_ml, frequency_days, duration_days, start_date, end_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.userId, animal_id || null, animal_name.trim(), medication.trim(),
     Number(weight_kg), Number(dose_per_kg), Number(concentration), totalMg, totalMl,
     Number(frequency_days), Number(duration_days), start_date, endDate, notes || null]
  );

  // Also creates a reminder task for the treatment, due today for as long as
  // the treatment window is open — see the maintenance query at the top of
  // GET /api/tasks, which keeps this due date current every day (and closes
  // the task out once end_date passes) without needing a cron job. Reuses
  // the existing "repeating task" UI (is_repeating) since this can't be
  // manually completed early — it just runs its course.
  await pool.query(
    `INSERT INTO tasks (id, user_id, title, due_date, priority, completed, is_repeating, animal_id, notes, dosage_record_id)
     VALUES (?, ?, ?, ?, 'high', FALSE, TRUE, ?, ?, ?)`,
    [randomUUID(), req.userId, `Give ${medication.trim()} to ${animal_name.trim()}`,
     start_date, animal_id || null, `Dosage: ${totalMl.toFixed(2)} ml`, id]
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
