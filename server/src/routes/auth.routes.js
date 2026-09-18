const express  = require('express');
const asyncHandler = require('../utils/asyncHandler');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const pool     = require('../db');
const { signToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
const { makeUploader, fileUrl } = require('../middleware/upload');

const router = express.Router();
const avatarUpload = makeUploader('avatars');

function publicUser(row) {
  return {
    id:        row.id,
    email:     row.email,
    name:      row.full_name || row.email,
    avatarUrl: row.avatar_url || null,
  };
}

// ── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', asyncHandler(async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
      [email.trim(), passwordHash, fullName?.trim() || null]
    );
    // id is a CHAR(36) filled in by the column's own DEFAULT (UUID()), not an
    // auto-increment value, so fetch the new row back by its unique email.
    const [userRows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
    const user = userRows[0];

    const token = signToken(user.id);
    res.status(201).json({ user: publicUser(user), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create account.' });
  }
}));

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = signToken(user.id);
    res.json({ user: publicUser(user), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not sign in.' });
  }
}));

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
// Called on app load with the stored token to restore the session (replaces
// Supabase's getCurrentUser() + onAuthStateChange bootstrap).
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!rows[0]) return res.status(401).json({ error: 'User no longer exists.' });
  res.json({ user: publicUser(rows[0]) });
}));

// ── PUT /api/auth/profile ───────────────────────────────────────────────────
router.put('/profile', requireAuth, asyncHandler(async (req, res) => {
  const { fullName } = req.body;
  if (!fullName || !fullName.trim()) return res.status(400).json({ error: 'Name cannot be empty.' });

  await pool.query('UPDATE users SET full_name = ? WHERE id = ?', [fullName.trim(), req.userId]);
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
  res.json({ user: publicUser(rows[0]) });
}));

// ── PUT /api/auth/password ──────────────────────────────────────────────────
router.put('/password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword) return res.status(400).json({ error: 'Please enter your current password.' });
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
  const user = rows[0];
  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.userId]);
  res.json({ message: 'Password updated.' });
}));

// ── POST /api/auth/avatar ───────────────────────────────────────────────────
router.post('/avatar', requireAuth, avatarUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const url = fileUrl(req, 'avatars', req.file.filename);
  await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.userId]);
  res.json({ url });
}));

// ── POST /api/auth/forgot-password ──────────────────────────────────────────
// NOTE: no email is actually sent yet — there's no SMTP provider configured.
// The reset link is logged to the server console so this is usable in dev.
// Wire up a real mail service (nodemailer + SMTP, SendGrid, etc.) before
// this goes anywhere near production.
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
  const user = rows[0];

  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to test which emails are registered.
  if (user) {
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, user.id]);

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    console.log(`\n[password reset] ${email} → ${resetLink}\n`);
  }

  res.json({ message: 'If that email is registered, a reset link has been sent.' });
}));

// ── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 6) {
    return res.status(400).json({ error: 'A valid token and a password of at least 6 characters are required.' });
  }

  const [rows] = await pool.query(
    'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
    [token]
  );
  const user = rows[0];
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
    [passwordHash, user.id]
  );
  res.json({ message: 'Password updated. You can now log in.' });
}));

// ── DELETE /api/auth/account ────────────────────────────────────────────────
// Cascades remove all of the user's animals, listings, orders, etc.
// automatically via the ON DELETE CASCADE foreign keys in the schema.
router.delete('/account', requireAuth, asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Please enter your password to confirm.' });

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Incorrect password.' });

  await pool.query('DELETE FROM users WHERE id = ?', [req.userId]);
  res.json({ message: 'Account deleted.' });
}));

module.exports = router;
