# Deploy Email API to Vercel - Step by Step

## Quick Steps

1. **Go to Vercel**: https://vercel.com
2. **Sign in** (or create account - it's free)
3. **Click "Add New Project"** (or "New Project")
4. **Import Git Repository** OR **Deploy manually**

## Option A: Deploy from Git (Recommended)

If your code is on GitHub:
1. Click "Import Git Repository"
2. Select your repository
3. Click "Import"
4. **Root Directory**: Leave as is (or set to project root)
5. **Build Settings**: 
   - Framework Preset: Other
   - Build Command: Leave empty (or `echo "No build needed"`)
   - Output Directory: Leave empty
6. Click "Environment Variables"
7. Add:
   - **Key**: `RESEND_API_KEY`
   - **Value**: (paste your Resend API key here)
8. Click "Deploy"

## Option B: Deploy via Vercel CLI (If you prefer terminal)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
cd "/Users/faiyaad/coding apps/focus app"
vercel

# Set environment variable
vercel env add RESEND_API_KEY
# When prompted, paste your Resend API key

# Redeploy with environment variable
vercel --prod
```

## Option C: Manual Upload via Dashboard

1. Go to https://vercel.com/new
2. Click "Deploy without Git"
3. **Create a zip file** with these files:
   - `api/send-verification.js`
   - `vercel.json`
   - `api/package.json` (if it exists)
4. Upload the zip
5. **Set Environment Variable**:
   - Go to Project Settings → Environment Variables
   - Add `RESEND_API_KEY` with your API key
6. Click "Deploy"

## After Deployment

1. Vercel will give you a URL like: `https://your-project.vercel.app`
2. Your API endpoint will be: `https://your-project.vercel.app/api/send-verification`
3. **Update app.js** - Change the `backendUrl` in the `sendVerificationEmail` function to your new URL

## Test It

Test your deployed API:
```bash
curl -X POST https://your-project.vercel.app/api/send-verification \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com","code":"123456"}'
```

If it returns `{"success":true}`, it's working! 🎉

## Important Notes

- **Free tier**: Vercel has a generous free tier
- **Environment Variables**: Make sure to set `RESEND_API_KEY` in the Vercel dashboard
- **API URL**: After deployment, update the URL in `app.js` if it's different from `https://0per8r-email-api.vercel.app`




