# Quick Deploy Guide (3 Steps)

## 1. Get Resend API Key (2 minutes)
- Go to https://resend.com
- Sign up (free)
- Go to API Keys → Create New
- Copy the key

## 2. Deploy to Vercel (5 minutes)

### Using Vercel Website (Recommended):
1. Go to https://vercel.com and sign up/login
2. Click "Add New Project"
3. Click "Import Git Repository" (connect your GitHub)
   - OR click "Deploy" and drag the entire project folder
4. After it deploys, go to:
   - Settings → Environment Variables
   - Add: `RESEND_API_KEY` = (paste your Resend key)
5. Redeploy (or it auto-redeploys)

### Get Your URL:
- After deployment, Vercel gives you a URL like: `https://your-app-name.vercel.app`
- Your API endpoint will be: `https://your-app-name.vercel.app/api/send-verification`

## 3. Update Your App (1 minute)
In `app.js`, find this line (around line 1114):
```javascript
const backendUrl = 'https://0per8r-email.vercel.app/send-verification';
```

Change it to:
```javascript
const backendUrl = 'https://your-app-name.vercel.app/api/send-verification';
```

(Replace `your-app-name` with your actual Vercel URL)

## Done! ✅
Emails will now be sent automatically when users sign up.

---

**Need help?** The full detailed guide is in `DEPLOY_EMAIL_BACKEND.md`







