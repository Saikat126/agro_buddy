-- ─── 15_username.sql ────────────────────────────────────────────────────────
-- Adds a unique handle distinct from full_name (which stays a free-text
-- display name and can repeat — two real people can share a name). The
-- table's utf8mb4_general_ci collation makes this UNIQUE index
-- case-insensitive too, so "Ahmed" and "ahmed" collide, same as other apps.

ALTER TABLE users
  ADD COLUMN username VARCHAR(30);

-- Backfill existing accounts from full_name so nothing is left NULL before
-- the NOT NULL + UNIQUE constraints go on below.
UPDATE users SET username = LOWER(full_name) WHERE username IS NULL;

ALTER TABLE users
  MODIFY COLUMN username VARCHAR(30) NOT NULL,
  ADD UNIQUE INDEX idx_users_username (username);
