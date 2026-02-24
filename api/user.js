// GET /api/user?token=xxx - Get user data
// POST /api/user - Update user preferences (body: { token, ...preferences })
const { createClient } = require('@supabase/supabase-js');

async function getUserByToken(supabase, token) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, username, preferences, session_expiry')
    .eq('session_token', token)
    .single();

  if (error || !data) return null;
  if (data.session_expiry && Date.now() > data.session_expiry) return null;
  return data;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(url, key);

  if (req.method === 'GET') {
    const token = (req.query && req.query.token) || '';
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }
    const user = await getUserByToken(supabase, token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    return res.status(200).json({
      ok: true,
      user: { id: user.id, email: user.email, username: user.username, preferences: user.preferences || {} }
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const token = body.token || '';
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }
    const user = await getUserByToken(supabase, token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const allowed = ['mission', 'goal', 'task', 'allowSites', 'allowApps', 'googleAlwaysAllowed', 'soundscape', 'soundscapeEnabled', 'streak'];
    const updates = {};
    allowed.forEach(k => {
      if (body[k] !== undefined) updates[k] = body[k];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(200).json({ ok: true, preferences: user.preferences || {} });
    }

    const newPrefs = { ...(user.preferences || {}), ...updates };
    const { error } = await supabase.from('users').update({ preferences: newPrefs }).eq('id', user.id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true, preferences: newPrefs });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
