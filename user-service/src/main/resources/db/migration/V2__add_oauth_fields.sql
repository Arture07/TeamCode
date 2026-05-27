-- V2: Add OAuth provider fields to app_user table
ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
    ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);

-- Allow null password for OAuth-only users
ALTER TABLE app_user ALTER COLUMN password DROP NOT NULL;

-- Index for fast OAuth lookup
CREATE INDEX IF NOT EXISTS idx_app_user_provider_provider_id
    ON app_user(provider, provider_id);
