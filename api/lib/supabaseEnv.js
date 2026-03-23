/**
 * SUPABASE_URL must be the project API URL: https://xxxxx.supabase.co
 * (Supabase Dashboard → Settings → API → Project URL).
 * NOT: supabase.com, app.supabase.com, or any dashboard link.
 */
function assertSupabaseProjectUrl(url) {
  const s = String(url || '').trim();
  if (!s.includes('.supabase.co')) {
    return {
      ok: false,
      error:
        'SUPABASE_URL must be https://YOUR_PROJECT_REF.supabase.co from Supabase Settings → API → Project URL (not supabase.com or the dashboard).'
    };
  }
  return { ok: true };
}

module.exports = { assertSupabaseProjectUrl };
