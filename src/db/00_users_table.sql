
CREATE TABLE IF NOT EXISTS users (

  id                     CHAR(36)     PRIMARY KEY DEFAULT (UUID()),

  email                  VARCHAR(255) NOT NULL UNIQUE,

  password_hash          VARCHAR(255) NOT NULL,

  full_name              VARCHAR(255),
  
  avatar_url             VARCHAR(1024),

  reset_token            VARCHAR(255),
  reset_token_expires    TIMESTAMP NULL,

  -- Set by POST /api/auth/register, cleared once the account is verified via
  -- the emailed link or the 24-hour window expires and a new one is requested.
  email_verified         BOOLEAN      NOT NULL DEFAULT FALSE,
  verify_token           VARCHAR(255),
  verify_token_expires   TIMESTAMP NULL,

  created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP

) ENGINE=InnoDB;

CREATE INDEX idx_users_reset_token  ON users(reset_token);
CREATE INDEX idx_users_verify_token ON users(verify_token);
