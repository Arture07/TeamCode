-- V3: Add role and account status fields to app_user table
ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'ROLE_USER',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Index on role for fast admin lookups
CREATE INDEX IF NOT EXISTS idx_app_user_role ON app_user(role);
