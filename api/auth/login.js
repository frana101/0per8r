// POST /api/auth/login - Sign in user
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { emailOrUsername, password } = req.body || {};
    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Email/username and password required' });
    }

    const supabase = createClient(url, key);
    const input = (emailOrUsername || '').trim().toLowerCase();
    const isEmail = input.includes('@');

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, username, password_hash, preferences, trial_ends_at, subscription_status, created_at')
      .eq(isEmail ? 'email' : 'username', isEmail ? input : emailOrUsername.trim())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Account not found. Please sign up first.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const now = Date.now();
    const trialActive = user.trial_ends_at != null && user.trial_ends_at > now;
    const paid = user.subscription_status === 'active';
    if (!trialActive && !paid) {
      return res.status(402).json({
        error: 'Your free trial has ended.',
        code: 'subscription_required',
        message: 'Subscribe to continue using 0per8r.'
      });
    }

    const sessionToken = require('crypto').randomBytes(32).toString('hex');
    const sessionExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

    await supabase.from('users').update({
      session_token: sessionToken,
      session_expiry: sessionExpiry
    }).eq('id', user.id);

    const prefs = user.preferences || {};
    return res.status(200).json({
      ok: true,
      token: sessionToken,
      expiry: sessionExpiry,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        preferences: prefs
      }
    });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: e.message || 'Login failed' });
  }
};
