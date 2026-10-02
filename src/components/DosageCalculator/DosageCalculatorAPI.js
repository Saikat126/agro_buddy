import client from '../../api/client';


// Validates every field before we touch the database.
// All numeric fields must be positive; start_date must be a real date.
export function validateDosageRecord(record) {
  const errors = {};

  if (!record.animal_name || !record.animal_name.trim()) {
    errors.animal_name = 'Animal name is required.';
  }

  if (!record.medication || !record.medication.trim()) {
    errors.medication = 'Medication name is required.';
  }

  if (!record.weight_kg || Number(record.weight_kg) <= 0) {
    errors.weight_kg = 'Animal weight must be greater than zero.';
  }

  if (!record.dose_per_kg || Number(record.dose_per_kg) <= 0) {
    errors.dose_per_kg = 'Dose per kg must be greater than zero.';
  }

  if (!record.concentration || Number(record.concentration) <= 0) {
    errors.concentration = 'Concentration must be greater than zero.';
  }

  if (!record.frequency_days || Number(record.frequency_days) < 1) {
    errors.frequency_days = 'Frequency must be at least 1 day.';
  }

  if (!record.duration_days || Number(record.duration_days) < 1) {
    errors.duration_days = 'Duration must be at least 1 day.';
  }

  if (!record.start_date || isNaN(Date.parse(record.start_date))) {
    errors.start_date = 'A valid start date is required.';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}


// Saves a completed dosage calculation to the database.
export async function saveDosageRecord(record) {
  const errors = validateDosageRecord(record);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.post('/dosage', record);
  return data;
}


// Fetches all saved records for the current user, newest first.
export async function fetchDosageRecords() {
  const { data } = await client.get('/dosage');
  return data;
}


// Fetches records for a specific animal — useful for a per-animal health history view.
export async function fetchDosageRecordsByAnimal(animalId) {
  const { data } = await client.get('/dosage', { params: { animal_id: animalId } });
  return data;
}


// Fetches records where the treatment is still ongoing today.
export async function fetchActiveTreatments() {
  const { data } = await client.get('/dosage', { params: { active: true } });
  return data;
}


// Permanently deletes a dosage record. No soft-delete here.
export async function deleteDosageRecord(id) {
  await client.delete(`/dosage/${id}`);
}
