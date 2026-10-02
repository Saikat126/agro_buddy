// Converts a Date object to 'YYYY-MM-DD' using its own LOCAL year/month/day.
// Deliberately NOT date.toISOString().split('T')[0] — toISOString() converts
// to UTC, so for anyone east of UTC (e.g. UTC+6), local midnight rolls back
// to the previous day once converted, silently shifting the date by one.
// That exact bug deleted a user's calendar event a day early: it was saved
// under the wrong (earlier) date, so by the time the real day arrived it
// already looked like a past event to the cleanup query.
export function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
