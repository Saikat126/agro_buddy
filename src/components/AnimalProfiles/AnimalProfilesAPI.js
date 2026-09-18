import client from '../../api/client';


// Validates before any insert or update. Only name and species are required;
export function validateAnimalData(data) {
  const errors = {};

  if (!data.name || !data.name.trim()) {
    errors.name = 'Animal name is required.';
  }

  if (!data.species || !data.species.trim()) {
    errors.species = 'Species is required (e.g., Cattle, Goat, Chicken).';
  }

  if (data.age_years !== undefined && data.age_years !== null && data.age_years !== '') {
    const age = Number(data.age_years);
    if (isNaN(age) || age < 0) {
      errors.age_years = 'Age must be a positive number (e.g., 1.5 for 18 months).';
    }
  }

  if (data.weight_kg !== undefined && data.weight_kg !== null && data.weight_kg !== '') {
    const weight = Number(data.weight_kg);
    if (isNaN(weight) || weight <= 0) {
      errors.weight_kg = 'Weight must be greater than zero.';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}


// Uploads an animal photo and returns its URL, ready to attach as image_url
// when creating or updating the animal.
export async function uploadAnimalImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await client.post('/uploads/animal', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}


// Fetches all animals for the current user, newest first.
export async function fetchAnimals() {
  const { data } = await client.get('/animals');
  return data;
}


// Fetches a single animal by id.
export async function fetchAnimalById(id) {
  const { data } = await client.get('/animals');
  const animal = data.find((a) => a.id === id);
  if (!animal) throw new Error('Animal not found.');
  return animal;
}


// Inserts a new animal. The backend attaches the current user's id from the auth token.
export async function createAnimal(animalData) {
  const errors = validateAnimalData(animalData);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.post('/animals', animalData);
  return data;
}


// Updates an existing animal's fields.
export async function updateAnimal(id, animalData) {
  const errors = validateAnimalData(animalData);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.put(`/animals/${id}`, animalData);
  return data;
}


// Permanently deletes an animal. The backend only lets you delete your own.
export async function deleteAnimal(id) {
  await client.delete(`/animals/${id}`);
}
