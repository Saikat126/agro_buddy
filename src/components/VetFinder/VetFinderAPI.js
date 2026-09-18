import client from '../../api/client';


// Name is the only required field. Phone and email are optional,

export function validateVetData(data) {
  const errors = {};

  if (!data.name || !data.name.trim()) {
    errors.name = 'Vet name is required.';
  }

  if (data.phone) {
    const digits = data.phone.replace(/\D/g, '');
    if (digits.length < 7) {
      errors.phone = 'Phone number must contain at least 7 digits.';
    }
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (data.rating !== undefined && data.rating !== null && data.rating !== '') {
    const r = Number(data.rating);
    if (isNaN(r) || r < 0 || r > 5) {
      errors.rating = 'Rating must be a number between 0 and 5.';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}


// Fetches all vets visible to the current user (public ones + their own private ones).

export async function fetchVets() {
  const { data } = await client.get('/vets');
  return data;
}


// Searches vets by name, specialty, clinic, and location in one call.
export async function searchVets(query, location) {
  const params = {};
  if (query && query.trim()) params.search = query.trim();
  if (location && location.trim()) params.location = location.trim();
  const { data } = await client.get('/vets', { params });
  return data;
}


// Fetches only vets who are flagged as currently available.

export async function fetchAvailableVets() {
  const { data } = await client.get('/vets', { params: { available: true } });
  return data;
}


// Adds a new vet to the shared directory.

export async function createVet(vetData) {
  const errors = validateVetData(vetData);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.post('/vets', vetData);
  return data;
}


// Updates a vet's details.
export async function updateVet(id, vetData) {
  const errors = validateVetData(vetData);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.put(`/vets/${id}`, vetData);
  return data;
}


export async function updateVetAvailability(id, available) {
  const { data } = await client.patch(`/vets/${id}/availability`, { available });
  return data;
}


// Permanently removes a vet record. The backend only lets you delete your own.
export async function deleteVet(id) {
  await client.delete(`/vets/${id}`);
}
