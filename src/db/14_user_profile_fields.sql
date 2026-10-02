-- ─── 14_user_profile_fields.sql ────────────────────────────────────────────
-- Adds optional contact/location fields to the Edit Profile form.
-- Purely additive: existing users just get NULL for both.

ALTER TABLE users
  ADD COLUMN phone    VARCHAR(50),
  ADD COLUMN district VARCHAR(100);
