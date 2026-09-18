import client from '../../api/client';


// Mirrors the CHECK constraint in the database migration.

export const EVENT_TYPES = ['vet', 'harvest', 'market', 'medication', 'other'];


// Validates an event before insert or update.

export function validateEventData(data) {
  const errors = {};

  if (!data.title || !data.title.trim()) {
    errors.title = 'Event title is required.';
  }

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


// Fetches all events for the current user, sorted by date ascending

export async function fetchEvents() {
  const { data } = await client.get('/calendar');
  return data;
}


// Fetches events for a specific month.
export async function fetchEventsByMonth(year, month) {
  const { data } = await client.get('/calendar', { params: { year, month } });
  return data;
}


// Fetches only events of a given type — e.g., show only vet visits.
export async function fetchEventsByType(eventType) {
  if (!EVENT_TYPES.includes(eventType)) {
    throw new Error(`Invalid event type: "${eventType}". Must be one of: ${EVENT_TYPES.join(', ')}.`);
  }
  const { data } = await client.get('/calendar', { params: { type: eventType } });
  return data;
}


// Saves a new event. completed defaults to false — the user can mark it done later.
export async function createEvent(eventData) {
  const errors = validateEventData(eventData);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.post('/calendar', eventData);
  return data;
}


// Edits an existing event's details.
export async function updateEvent(id, eventData) {
  const errors = validateEventData(eventData);
  if (errors) throw new Error(JSON.stringify(errors));

  const { data } = await client.put(`/calendar/${id}`, eventData);
  return data;
}


// Marks an event done (or un-marks it).
export async function markEventComplete(id, completed) {
  const { data } = await client.patch(`/calendar/${id}/complete`, { completed });
  return data;
}


// Permanently deletes a single event.
export async function deleteEvent(id) {
  await client.delete(`/calendar/${id}`);
}


// Deletes all events whose date has already passed.
export async function deletePastEvents() {
  await client.delete('/calendar/past');
}
