// POST /api/webhooks/stripe — reserved for Stripe (paid access) when you add subscriptions.
// Today: verifies signature if configured, returns 200 (no DB updates).
// Later: run supabase-future-subscription.sql, then restore user updates (see file comments / git history).
const Stripe = require('stripe');
const { assertSupabaseProjectUrl } = require('../lib/supabaseEnv');

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(200).json({ received: true, message: 'Stripe webhook secret not set — no-op' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({ received: true, message: 'Supabase env missing — no-op' });
  }
  const urlCheck = assertSupabaseProjectUrl(supabaseUrl);
  if (!urlCheck.ok) {
    return res.status(200).json({ received: true, message: 'Invalid SUPABASE_URL — no-op' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).send('No signature');
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (e) {
    return res.status(400).send('Invalid body');
  }

  try {
    Stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Paid-tier DB updates disabled until subscription columns + app logic are added.
  return res.status(200).json({ received: true });
};
