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
   - `SUPABASE_URL` = **Project URL** from Supabase **Settings → API** — must look like `https://YOUR_REF.supabase.co` (not `supabase.com`, not the dashboard)
   - `SUPABASE_SERVICE_KEY` = your **service_role** key (not anon)
4. Deploy

Your API will be at `https://your-project.vercel.app/api/...`

**If signup/login returns 401:** Your project may have **Deployment Protection** on. In Vercel → Project → **Settings** → **Deployment Protection**, turn it off (or set to "Only Preview deployments") so the API can be called without auth.

### Option B: Deploy only the API folder

Create a separate Vercel project with the `api` folder and `vercel.json`, add the env vars above.

## 5. Update the App with Your API URL

In `app.js`, set `getApiBase()` to your Vercel URL (e.g. `https://0per8r-complete1.vercel.app`).

## 6. Free trials & Stripe (later)

There is **no** trial or paywall in the app or API right now: any valid account can sign in.

When you want time-limited trials and/or paid access:

1. Run **`supabase-future-subscription.sql`** in the Supabase SQL Editor (adds `trial_ends_at` and `subscription_status`).
2. Re-implement checks in **`api/auth/login.js`** (e.g. allow login only if trial not expired or `subscription_status = 'active'`), set trial on **`api/auth/register.js`**, and wire **`api/webhooks/stripe.js`** to mark users paid after Stripe checkout. Add **`STRIPE_WEBHOOK_SECRET`** in Vercel and a payment link + 402 handling in the app as needed.

---

## API Endpoints

- `POST /api/auth/register` – Create account
- `POST /api/auth/login` – Sign in
- `GET /api/user?token=xxx` – Get user data
- `POST /api/user` – Update user preferences (body: `{ token, ...preferences }`)
- `POST /api/webhooks/stripe` – Stripe webhook stub (signature verified if `STRIPE_WEBHOOK_SECRET` is set; no subscription DB updates until you build that flow)
