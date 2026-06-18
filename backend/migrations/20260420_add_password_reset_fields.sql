-- Add password reset columns for forgot-password flow
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS reset_password_expires DATETIME NULL;

CREATE INDEX IF NOT EXISTS idx_users_reset_password_token ON users (reset_password_token);
