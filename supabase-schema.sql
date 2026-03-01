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
  trial_ends_at BIGINT,
  subscription_status TEXT DEFAULT 'trial',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_token);

-- If you already have the users table, run this to add trial/subscription columns:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at BIGINT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
-- UPDATE users SET subscription_status = 'trial', trial_ends_at = (EXTRACT(EPOCH FROM NOW()) * 1000) + (14 * 24 * 60 * 60 * 1000) WHERE trial_ends_at IS NULL AND subscription_status IS NULL;
