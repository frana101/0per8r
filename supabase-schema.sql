-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Creates the users table for 0per8r auth backend

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  preferences JSONB DEFAULT '{}',
  session_token TEXT,
  session_expiry BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_token);

-- To remove trial/subscription columns from an older database (optional):
-- ALTER TABLE users DROP COLUMN IF EXISTS trial_ends_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS subscription_status;
