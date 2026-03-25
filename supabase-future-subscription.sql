-- NOT RUN BY DEFAULT — use when you want free trials + paid access (Stripe).
-- 1. Run this in Supabase SQL Editor.
-- 2. Re-add trial checks in api/auth/login.js, trial fields in api/auth/register.js,
--    STRIPE_CHECKOUT_URL + 402 handling in app.js, and DB updates in api/webhooks/stripe.js
--    (see git history or ask to restore).

ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';

-- Example: give existing users a 14-day trial from now (milliseconds since epoch)
-- UPDATE users SET subscription_status = 'trial', trial_ends_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT + (14 * 24 * 60 * 60 * 1000)
--   WHERE trial_ends_at IS NULL;

-- Login logic (when you implement it): allow access if trial_ends_at > now() OR subscription_status = 'active'.
