// POST /api/auth/register - Create new user account
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
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { email, username, password } = req.body || {};
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username, and password required' });
    }

    const emailLower = email.trim().toLowerCase();
    const usernameTrimmed = username.trim();
    if (usernameTrimmed.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const supabase = createClient(url, key);
    const passwordHash = await bcrypt.hash(password, 10);
    const sessionToken = require('crypto').randomBytes(32).toString('hex');
    const sessionExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    const { data: existingEmail } = await supabase.from('users').select('id').eq('email', emailLower).single();
    if (existingEmail) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const { data: existingUsername } = await supabase.from('users').select('id').eq('username', usernameTrimmed).single();
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const preferences = {
      mission: '',
      goal: '',
      task: '',
      allowSites: [],
      allowApps: [],
      googleAlwaysAllowed: true,
      soundscape: { rain: 0, ocean: 0, fire: 0, wind: 0, forest: 0, cafe: 0, cityscape: 0 },
      soundscapeEnabled: true,
      streak: 0
    };

    const { data: user, error } = await supabase.from('users').insert({
      email: emailLower,
      username: usernameTrimmed,
      password_hash: passwordHash,
      preferences,
      session_token: sessionToken,
      session_expiry: sessionExpiry,
      created_at: new Date().toISOString()
    }).select('id, email, username, preferences, created_at').single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: error.message || 'Registration failed' });
    }

    return res.status(200).json({
      ok: true,
      token: sessionToken,
      expiry: sessionExpiry,
      user: { id: user.id, email: user.email, username: user.username, preferences: user.preferences || preferences }
    });
  } catch (e) {
    console.error('Register error:', e);
    return res.status(500).json({ error: e.message || 'Registration failed' });
  }
};
