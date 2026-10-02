const express  = require('express');
const asyncHandler = require('../utils/asyncHandler');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const dns      = require('dns').promises;
const pool     = require('../db');
const { signToken } = require('../utils/jwt');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { makeUploader, fileUrl } = require('../middleware/upload');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function validateUsername(username) {
  if (!username || !USERNAME_RE.test(username.trim())) {
    return 'Username must be 3–20 characters: letters, numbers, and underscores only.';
  }
  return null;
}

// The table's utf8mb4_general_ci collation already makes this comparison
// case-insensitive (matching the UNIQUE index), so "Ahmed" and "ahmed" collide.
async function usernameTaken(username, excludeUserId) {
  const [rows] = await pool.query(
    'SELECT id FROM users WHERE username = ? AND id != ?',
    [username.trim(), excludeUserId || '']
  );
  return rows.length > 0;
}

// Checks that the email's domain actually has mail servers configured, so
// typos like "gmial.com" or entirely made-up domains get rejected up front
// instead of silently creating an account nobody can ever verify. This can't
// catch "real domain, but that specific mailbox doesn't exist" (e.g. a typo
// in the local part of a real gmail.com address) — that would need a paid
// verification service (ZeroBounce, NeverBounce, etc.) to check reliably.
async function domainAcceptsMail(email) {
  const domain = email.split('@')[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return false; // the domain genuinely doesn't exist, or has no mail servers at all
    }
    // Some other failure (DNS server unreachable, timeout, etc.) — that's an
    // infrastructure hiccup, not evidence the domain is bad, so don't block
    // a real signup over it. Fail open and just log it.
    console.warn(`[domainAcceptsMail] Could not check MX records for "${domain}" (${err.code}) — allowing registration to proceed.`);
    return true;
  }
}

const router = express.Router();
const avatarUpload = makeUploader('avatars');

function publicUser(row) {
  return {
    id:        row.id,
    email:     row.email,
    name:      row.full_name || row.email,
    username:  row.username,
    avatarUrl: row.avatar_url || null,
    phone:     row.phone || null,
    district:  row.district || null,
  };
}

// ── POST /api/auth/register ─────────────────────────────────────────────────
// Does NOT log the user in — the account starts unverified and login is
// blocked (see /login below) until they click the link this sends.
router.post('/register', asyncHandler(async (req, res) => {
  try {
    const { email, password, fullName, username } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const usernameError = validateUsername(username);
    if (usernameError) return res.status(400).json({ error: usernameError });
    if (await usernameTaken(username)) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    if (!(await domainAcceptsMail(email.trim()))) {
      return res.status(400).json({ error: "That email's domain doesn't appear to accept mail — please check for typos." });
    }

    // The expiry comparison is done in SQL (NOW()), not in JS — this pool is
    // configured with dateStrings: true, so verify_token_expires comes back
    // as a MySQL-formatted string, and comparing that to `new Date()` with
    // `>` in JS silently coerces to NaN and is always false. Let MySQL do it.
    const [existing] = await pool.query(
      `SELECT *, (email_verified = FALSE AND verify_token_expires > NOW()) AS still_pending
       FROM users WHERE email = ?`,
      [email.trim()]
    );
    if (existing.length > 0) {
      const row = existing[0];

      if (row.email_verified) {
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }
      if (row.still_pending) {
        return res.status(409).json({ error: 'An account with that email is awaiting verification. Check your inbox, or try again once that link expires.' });
      }
      // Unverified AND its verification window has lapsed — nobody ever
      // confirmed this address, so free it up instead of permanently
      // squatting on it (the common case: someone mistyped their email and
      // the real owner, or the same person retrying, needs it back).
      await pool.query('DELETE FROM users WHERE id = ?', [row.id]);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verifyToken   = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, username, verify_token, verify_token_expires)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email.trim(), passwordHash, fullName?.trim() || null, username.trim(), verifyToken, verifyExpires]
    );

    const verifyLink = `${process.env.CLIENT_URL}/?verify=${verifyToken}`;

    // Separate from the account creation itself: the user row above is
    // already committed, so a transient SMTP failure here must not report
    // "Could not create account" — that would be a lie, and worse, retrying
    // registration would then just hit the 409 "awaiting verification" path
    // with no email ever having been sent, locking the address out for 24h.
    // "Resend Verification" already exists as a recovery path, so just point there.
    try {
      await sendVerificationEmail(email.trim(), verifyLink);
      res.status(201).json({ message: 'Account created! Check your email for a verification link before logging in.' });
    } catch (emailErr) {
      console.error('[register] account created but verification email failed to send:', emailErr);
      res.status(201).json({
        message: 'Account created, but we couldn\'t send the verification email right now. ' +
                  'Use "Resend Verification" below to get a new link.',
        emailSendFailed: true,
      });
    }
  } catch (err) {
    // Guards the rare race between usernameTaken()'s check and this INSERT
    // (two signups for the same name landing at once) — the UNIQUE index
    // still catches it, just report it the same way as the earlier check.
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
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

    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const token = signToken(user.id);
    res.json({ user: publicUser(user), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not sign in.' });
  }
}));

// ── POST /api/auth/verify-email ─────────────────────────────────────────────
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing verification token.' });

  const [rows] = await pool.query(
    'SELECT * FROM users WHERE verify_token = ? AND verify_token_expires > NOW()',
    [token]
  );
  const user = rows[0];
  if (!user) return res.status(400).json({ error: 'This verification link is invalid or has expired.' });

  await pool.query(
    'UPDATE users SET email_verified = TRUE, verify_token = NULL, verify_token_expires = NULL WHERE id = ?',
    [user.id]
  );
  // email comes back too so the frontend can prefill/announce it on the
  // signup tab if verification happened in a different browser tab.
  res.json({ message: 'Email verified! You can now log in.', email: user.email });
}));

// ── POST /api/auth/resend-verification ──────────────────────────────────────
router.post('/resend-verification', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
  const user = rows[0];

  // Same response either way — don't leak whether an account/email exists.
  if (user && !user.email_verified) {
    const verifyToken   = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      'UPDATE users SET verify_token = ?, verify_token_expires = ? WHERE id = ?',
      [verifyToken, verifyExpires, user.id]
    );
    const verifyLink = `${process.env.CLIENT_URL}/?verify=${verifyToken}`;
    await sendVerificationEmail(email.trim(), verifyLink);
  }

  res.json({ message: 'If that account needs verifying, a new link has been sent.' });
}));

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
// Called on app load with the stored token to restore the session (replaces
// Supabase's getCurrentUser() + onAuthStateChange bootstrap).
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!rows[0]) return res.status(401).json({ error: 'User no longer exists.' });
  res.json({ user: publicUser(rows[0]) });
}));

// ── GET /api/auth/check-username ────────────────────────────────────────────
// Used by both the sign-up form (no session yet) and the Edit Profile form
// (logged in — excludes the caller's own current username) for live
// availability feedback before they submit.
router.get('/check-username', optionalAuth, asyncHandler(async (req, res) => {
  const usernameError = validateUsername(req.query.username);
  if (usernameError) return res.json({ available: false, error: usernameError });
  const taken = await usernameTaken(req.query.username, req.userId);
  res.json({ available: !taken });
}));

// ── PUT /api/auth/profile ───────────────────────────────────────────────────
// The Edit Profile form always submits all fields together, so phone/
// district are simply set to whatever came in (blank or omitted -> NULL),
// which also doubles as how someone clears a value they'd set earlier.
router.put('/profile', requireAuth, asyncHandler(async (req, res) => {
  const { fullName, username, phone, district } = req.body;
  if (!fullName || !fullName.trim()) return res.status(400).json({ error: 'Name cannot be empty.' });

  const usernameError = validateUsername(username);
  if (usernameError) return res.status(400).json({ error: usernameError });
  if (await usernameTaken(username, req.userId)) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  try {
    await pool.query(
      'UPDATE users SET full_name = ?, username = ?, phone = ?, district = ? WHERE id = ?',
      [fullName.trim(), username.trim(), phone?.trim() || null, district?.trim() || null, req.userId]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    throw err;
  }
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

    const resetLink = `${process.env.CLIENT_URL}/?token=${token}`;
    await sendPasswordResetEmail(email.trim(), resetLink);
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
