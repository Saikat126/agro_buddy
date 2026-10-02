import axios from 'axios';

// Base URL of the Express/MySQL backend (see /server). Falls back to the
// local dev default so this works out of the box with `npm run dev` there.
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'agro_buddy_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

const client = axios.create({ baseURL: API_URL });

// Attaches the stored JWT to every request — the backend's requireAuth
// middleware reads it from this header (see server/src/middleware/auth.js).
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// The backend replies with { error: '...' } on failure, and sometimes a
// machine-readable { code: '...' } alongside it (e.g. 'EMAIL_NOT_VERIFIED')
// for cases the UI needs to branch on rather than just display. Unwrap into a
// plain Error — with that code attached — so every *API.js file can keep
// doing `catch (err) { err.message }` exactly like it did with supabase-js,
// while call sites that care can also check `err.code`.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Something went wrong.';
    const wrapped = new Error(message);
    if (err.response?.data?.code) wrapped.code = err.response.data.code;
    return Promise.reject(wrapped);
  }
);

export default client;
