// POST /api/webhooks/stripe - Stripe calls this when a payment succeeds
// Set this URL in Stripe Dashboard: Webhooks -> Add endpoint -> https://your-app.vercel.app/api/webhooks/stripe
// Event: checkout.session.completed
// Add env var: STRIPE_WEBHOOK_SECRET (from Stripe webhook signing secret)
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

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
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!secret || !supabaseUrl || !supabaseKey) {
    console.error('Missing STRIPE_WEBHOOK_SECRET or Supabase env');
    return res.status(500).end();
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

  let event;
  try {
    event = Stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || (session.customer_details && session.customer_details.email);
    if (!email) {
      console.error('No email in checkout session');
      return res.status(200).json({ received: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) {
      console.error('User not found for email:', email);
      return res.status(200).json({ received: true });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ subscription_status: 'active', trial_ends_at: null })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update user:', updateError);
    }
  }

  return res.status(200).json({ received: true });
};
