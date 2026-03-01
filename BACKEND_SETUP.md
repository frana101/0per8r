# 0per8r Backend Setup (v1.2.9+)

The app now stores user data on a backend so users can sign in from any device.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → Sign up / Log in
2. New Project → choose org, name it (e.g. `0per8r`)
3. Set a database password and save it
4. Wait for project to finish provisioning

## 2. Create the Users Table

1. In Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Paste the contents of `supabase-schema.sql` from this project
4. Click **Run**

## 3. Get Supabase Credentials

1. In Supabase Dashboard → **Settings** → **API**
2. Copy **Project URL** (e.g. `https://xxx.supabase.co`)
3. Copy **service_role** key (under "Project API keys") – this is the secret key, never expose it to the client

## 4. Deploy API to Vercel

### Option A: Deploy this whole repo to Vercel

1. Push this repo to GitHub (if not already)
2. Go to [vercel.com](https://vercel.com) → Import your repo
3. Add Environment Variables:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_SERVICE_KEY` = your service_role key
4. Deploy

Your API will be at `https://your-project.vercel.app/api/...`

### Option B: Deploy only the API folder

Create a separate Vercel project with the `api` folder and `vercel.json`, add the env vars above.

## 5. Update the App with Your API URL

In `app.js`, find the line:

```javascript
const API_BASE = 'https://0per8r.vercel.app';
```

Replace with your actual Vercel deployment URL (e.g. `https://your-project.vercel.app`). If you deploy this repo to Vercel, the default URL is usually `https://0per8r.vercel.app` or similar.

## 6. Stripe (trial + paid subscription)

If you use the trial/subscription flow, do the following.

### Database

If `users` already existed before trial columns were added, run in Supabase SQL Editor (see comments at bottom of `supabase-schema.sql`):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
```

### Vercel env

In Vercel → Project → Settings → Environment Variables, add:

- `STRIPE_WEBHOOK_SECRET` = signing secret from Stripe (see below)

(You already need `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` for the webhook.)

### Stripe Dashboard

1. **Payment link**  
   Create a Payment Link in Stripe (Products → Payment Links) and copy the URL.

2. **Webhook**  
   - Developers → Webhooks → Add endpoint  
   - URL: `https://<your-vercel-host>/api/webhooks/stripe`  
   - Event: `checkout.session.completed`  
   - Copy the **Signing secret** and set it in Vercel as `STRIPE_WEBHOOK_SECRET`.

3. **Same email**  
   Users must use the **same email** in the app and at Stripe Checkout so the webhook can mark their account as paid.

### App

In `app.js`, set your Stripe Checkout URL:

```javascript
const STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/...';  // paste your Payment Link here
```

When login returns “trial ended” (402), the app shows “Subscribe to continue” and opens this link.

---

## API Endpoints

- `POST /api/auth/register` – Create account (starts 14-day trial)
- `POST /api/auth/login` – Sign in (402 if trial ended and not paid)
- `GET /api/user?token=xxx` – Get user data
- `POST /api/user` – Update user preferences (body: `{ token, ...preferences }`)
- `POST /api/webhooks/stripe` – Stripe webhook (do not call manually)
