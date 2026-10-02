// Shared by every form's change handler so free-text fields always save with
// a capitalized first letter — applied on every keystroke (not just on
// submit) so what's on screen always matches what gets saved.

export function capitalizeFirst(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Only plain text inputs and textareas get capitalized — email, password,
// tel, number, date, and <select> are left untouched since forcing a
// capital there would be meaningless (number/date) or actively break things
// (email/password must stay exactly as typed).
export function isFreeTextField(target) {
  if (target.tagName === 'TEXTAREA') return true;
  return target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'search');
}

// Drop-in replacement for the "const { name, value } = e.target" line at the
// top of a handleChange — returns the value already capitalized when the
// field qualifies, unchanged otherwise.
export function capitalizedValue(e) {
  return isFreeTextField(e.target) ? capitalizeFirst(e.target.value) : e.target.value;
}
