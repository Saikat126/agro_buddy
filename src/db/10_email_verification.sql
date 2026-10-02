-- ─── 10_email_verification.sql ─────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN verify_token         VARCHAR(255),
  ADD COLUMN verify_token_expires TIMESTAMP NULL;

CREATE INDEX idx_users_verify_token ON users(verify_token);

UPDATE users SET email_verified = TRUE;
