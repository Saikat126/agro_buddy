import client, { setToken, clearToken, getToken } from '../../api/client';

function normalizeUser(user) {
  return user
    ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl }
    : null;
}

// Creates a new account and stores the session token.
export async function signUp(email, password, fullName) {
  const { data } = await client.post('/auth/register', { email, password, fullName });
  setToken(data.token);
  return { user: normalizeUser(data.user) };
}

// Signs in an existing user and stores the session token.
export async function signIn(email, password) {
  const { data } = await client.post('/auth/login', { email, password });
  setToken(data.token);
  return { user: normalizeUser(data.user) };
}

// Sessions are a stateless JWT held in localStorage, so "signing out" just
// means forgetting it client-side — there's nothing to invalidate server-side.
export async function signOut() {
  clearToken();
}

// Used on app startup to check if there's already a valid session.
// Returns null (instead of throwing) for "no session" / "expired session" —
// the App.jsx bootstrap just wants a yes/no answer, not an error to handle.
export async function getCurrentUser() {
  if (!getToken()) return null;
  try {
    const { data } = await client.get('/auth/me');
    return normalizeUser(data.user);
  } catch {
    clearToken(); // stale/expired token — clear it so we don't keep retrying
    return null;
  }
}

// Updates the display name shown in the navbar / profile panel.
export async function updateProfileName(fullName) {
  const { data } = await client.put('/auth/profile', { fullName });
  return normalizeUser(data.user);
}

// Changes the current password. The backend re-verifies currentPassword
// itself, so there's no separate "sign in again to confirm" step needed here.
export async function updatePassword(currentPassword, newPassword) {
  await client.put('/auth/password', { currentPassword, newPassword });
}

// Uploads a profile photo and persists its URL onto the user's account.
// Returns the new avatar URL.
export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await client.post('/auth/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}

// Sends a password-reset email. The link points back to this app with a
// ?token=... query param that Auth.jsx reads to show the "set new password" form.
// NOTE: the backend only logs this link to its own console for now — see
// server/src/routes/auth.routes.js for wiring up a real mail provider.
export async function requestPasswordReset(email) {
  await client.post('/auth/forgot-password', { email });
}

// Completes a password reset using the token from the emailed link.
export async function resetPassword(token, password) {
  await client.post('/auth/reset-password', { token, password });
}

// Permanently deletes the signed-in user's account (and, via the database's
// ON DELETE CASCADE constraints, everything that belongs to them).
export async function deleteAccount(password) {
  await client.delete('/auth/account', { data: { password } });
  clearToken();
}
