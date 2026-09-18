-- ─── 00_users_table.sql ────────────────────────────────────────────────────────
-- MySQL has nothing like Supabase's built-in `auth.users` table, so the app now
-- owns user accounts directly. Every user_id / buyer_id / seller_id foreign key
-- in the rest of this schema points here instead.
--
-- NOTE: this table only holds the data. Session handling (JWTs), email
-- verification, and actually sending password-reset emails are NOT part of
-- the database layer — they live in the Express backend (see /server).
-- Likewise, the "you can only see/edit your own rows" rules that used to be
-- Postgres Row-Level Security policies are gone from every table below; that
-- access control is now enforced in the backend's API routes
-- (e.g. `WHERE user_id = req.user.id`), not by the database.

CREATE TABLE IF NOT EXISTS users (

  id                     CHAR(36)     PRIMARY KEY DEFAULT (UUID()),

  email                  VARCHAR(255) NOT NULL UNIQUE,

  -- Set by the backend after hashing (bcrypt) — never store a plain-text password.
  password_hash          VARCHAR(255) NOT NULL,

  full_name              VARCHAR(255),

  avatar_url             VARCHAR(1024),

  -- Set by POST /api/auth/forgot-password, cleared once the reset is used or expires.
  reset_token            VARCHAR(255),
  reset_token_expires    TIMESTAMP NULL,

  created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP

) ENGINE=InnoDB;

CREATE INDEX idx_users_reset_token ON users(reset_token);
