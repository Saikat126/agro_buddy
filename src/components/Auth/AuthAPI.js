import client, { setToken, clearToken, getToken } from '../../api/client';

function normalizeUser(user) {
  return user
    ? {
        id: user.id, email: user.email, name: user.name, username: user.username, avatarUrl: user.avatarUrl,
        phone: user.phone || null, district: user.district || null,
      }
    : null;
}

// Creates a new account. Does NOT log the user in — the backend requires the
// email to be verified first, so this just returns its confirmation message.
export async function signUp(email, password, fullName, username) {
  const { data } = await client.post('/auth/register', { email, password, fullName, username });
  return { message: data.message, emailSendFailed: !!data.emailSendFailed };
}

// Live availability check used while typing a username, both at sign-up and
// in Edit Profile. Never throws — a network hiccup just means no feedback yet.
export async function checkUsernameAvailable(username) {
  try {
    const { data } = await client.get('/auth/check-username', { params: { username } });
    return data; // { available, error? }
  } catch {
    return { available: null };
  }
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

// Updates the display name/username shown in the navbar / profile panel.
export async function updateProfile(fullName, username, phone, district) {
  const { data } = await client.put('/auth/profile', { fullName, username, phone, district });
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


export async function requestPasswordReset(email) {
  await client.post('/auth/forgot-password', { email });
}

// Completes a password reset using the token from the emailed link.
export async function resetPassword(token, password) {
  await client.post('/auth/reset-password', { token, password });
}

// Completes email verification using the token from the emailed link.
// Returns { message, email } — the email lets the tab that originally signed
// up (if still open elsewhere) announce which account just got verified.
export async function verifyEmail(token) {
  const { data } = await client.post('/auth/verify-email', { token });
  return { message: data.message, email: data.email };
}

// Requests a fresh verification link — used when the first one expired or
// went missing, or when login is blocked with EMAIL_NOT_VERIFIED.
export async function resendVerification(email) {
  await client.post('/auth/resend-verification', { email });
}

// Permanently deletes the signed-in user's account (and, via the database's
// ON DELETE CASCADE constraints, everything that belongs to them).
export async function deleteAccount(password) {
  await client.delete('/auth/account', { data: { password } });
  clearToken();
}
