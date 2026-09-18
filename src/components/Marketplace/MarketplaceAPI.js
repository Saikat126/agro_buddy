import client from '../../api/client';


// Keep this in sync with the CHECK constraint in the database migration.

export const VALID_CATEGORIES = ['Livestock', 'Crops', 'Equipment', 'Supplies', 'Other'];


// Validates a listing before insert or update.

export function validateListingData(data) {
  const errors = {};

  if (!data.title || !data.title.trim()) {
    errors.title = 'Listing title is required.';
  }

  if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
    errors.category = `Category must be one of: ${VALID_CATEGORIES.join(', ')}.`;
  }

  if (data.price === undefined || data.price === null || data.price === '') {
    errors.price = 'Price is required.';
  } else if (isNaN(Number(data.price)) || Number(data.price) <= 0) {
    errors.price = 'Price must be a positive number.';
  }

  if (!data.unit || !data.unit.trim()) {
    errors.unit = 'Unit is required (e.g., "per head", "per kg").';
  }

  if (!data.seller_name || !data.seller_name.trim()) {
    errors.seller_name = 'Seller name is required.';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}


// Uploads a listing photo and returns its URL, ready to attach as image_url
// when creating or updating the listing.
export async function uploadListingImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await client.post('/uploads/listing', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}


// Fetches all active listings from all users — this is the community marketplace.

export async function fetchListings() {
  const { data } = await client.get('/marketplace');
  return data;
}


// Fetches only listings in a specific category
export async function fetchListingsByCategory(category) {
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(`Invalid category: "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}.`);
  }
  const { data } = await client.get('/marketplace', { params: { category } });
  return data;
}


// Fetches all of the current user's own listings, including hidden ones.

export async function fetchMyListings() {
  const { data } = await client.get('/marketplace/mine');
  return data;
}


// Publishes a new listing. available is set to true by default so it shows up immediately.
export async function createListing(listingData) {
  const errors = validateListingData(listingData);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.post('/marketplace', listingData);
  return data;
}


// Edits the fields of an existing listing.
export async function updateListing(id, listingData) {
  const errors = validateListingData(listingData);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.put(`/marketplace/${id}`, listingData);
  return data;
}


// Shows or hides a listing without actually deleting it.

export async function toggleAvailability(id, available) {
  const { data } = await client.patch(`/marketplace/${id}/availability`, { available });
  return data;
}


// Permanently removes a listing. The backend only lets you remove your own.
export async function deleteListing(id) {
  await client.delete(`/marketplace/${id}`);
}
