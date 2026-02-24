# How to Deploy Email Backend to Vercel (Simple Guide)

## What You Need
- A Vercel account (free) - sign up at vercel.com
- A Resend API key (free tier available) - get it from resend.com

## Step-by-Step Instructions

### 1. Get Resend API Key
1. Go to https://resend.com
2. Sign up for free account
3. Go to API Keys section
4. Create a new API key
5. Copy the key (you'll need it later)

### 2. Deploy to Vercel

**Option A: Using Vercel Website (Easiest)**
1. Go to https://vercel.com
2. Sign up/login
3. Click "Add New Project"
4. Import your GitHub repository (or upload the `api` folder)
5. In project settings, go to "Environment Variables"
6. Add: `RESEND_API_KEY` = (paste your Resend API key)
7. Deploy!

**Option B: Using Command Line**
1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```
2. Go to your project folder
3. Run:
   ```bash
   vercel
   ```
4. Follow the prompts to login and deploy
5. After deployment, go to Vercel dashboard → Your project → Settings → Environment Variables
6. Add: `RESEND_API_KEY` = (your Resend API key)
7. Redeploy (or it will auto-redeploy)

### 3. Update Your App

After deployment, Vercel will give you a URL like: `https://your-project.vercel.app`

Update the URL in `app.js`:
```javascript
const backendUrl = 'https://your-project.vercel.app/api/send-verification';
```

### 4. That's It!

Emails will now be sent automatically when users sign up!

---

## Important Notes
- The `api` folder needs to be in your project root
- Make sure `RESEND_API_KEY` environment variable is set in Vercel
- The free tier of Resend allows 100 emails/day - enough for testing







