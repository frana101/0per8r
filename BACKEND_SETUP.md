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

## API Endpoints

- `POST /api/auth/register` – Create account
- `POST /api/auth/login` – Sign in
- `GET /api/user?token=xxx` – Get user data
- `POST /api/user` – Update user preferences (body: `{ token, ...preferences }`)
