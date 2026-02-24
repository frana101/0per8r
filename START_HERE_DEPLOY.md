# ⭐ START HERE: Deploy Email API (Super Simple)

## What You Need to Do

Create a **new, separate GitHub repo** with JUST the email API code, then deploy it to Vercel.

---

## Step-by-Step (Copy-Paste Friendly)

### Step 1: Create New Folder

```bash
cd ~/Desktop
mkdir 0per8r-email-api
cd 0per8r-email-api
mkdir api
```

### Step 2: Copy the API File

**From:** `/Users/faiyaad/coding apps/focus app/api/send-verification.js`  
**To:** `~/Desktop/0per8r-email-api/api/send-verification.js`

Just copy the file! (You can drag & drop it)

### Step 3: Create package.json

In `~/Desktop/0per8r-email-api/`, create `package.json` with this content:

```json
{
  "name": "0per8r-email-api",
  "version": "1.0.0"
}
```

### Step 4: Push to GitHub

```bash
cd ~/Desktop/0per8r-email-api
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

Then:
1. Go to https://github.com/new
2. Repository name: `0per8r-email-api`
3. **Don't** check "Initialize with README"
4. Click "Create repository"
5. Copy the commands GitHub shows you (they look like):
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/0per8r-email-api.git
   git push -u origin main
   ```
6. Paste those commands in Terminal

### Step 5: Deploy to Vercel

1. Go to https://vercel.com
2. Sign up/login (click "Continue with GitHub")
3. Click "Add New Project" (big button)
4. Find `0per8r-email-api` in the list
5. Click "Import"
6. Click "Deploy" (blue button)
7. Wait ~30 seconds for deployment
8. When it's done, click on the project name
9. Go to **Settings** (top menu)
10. Click **Environment Variables** (left sidebar)
11. Click "Add New"
12. Name: `RESEND_API_KEY`
13. Value: (paste your Resend API key)
14. Click "Save"
15. Go to **Deployments** tab
16. Click three dots (⋯) on latest deployment → "Redeploy"

### Step 6: Get URL and Update App

1. After redeploy, you'll see a URL like: `https://0per8r-email-api-xyz.vercel.app`
2. Your API URL is: `https://0per8r-email-api-xyz.vercel.app/api/send-verification`
3. Open your main project: `app.js`
4. Find line ~1114, change:
   ```javascript
   const backendUrl = 'https://0per8r-email.vercel.app/send-verification';
   ```
   To:
   ```javascript
   const backendUrl = 'https://YOUR_ACTUAL_URL.vercel.app/api/send-verification';
   ```

---

## Important Notes

✅ **GitHub Repo** = Where your code lives (like a folder in the cloud)  
✅ **Vercel** = Hosting service that runs your API (like a server)  
✅ **Releases** = For distributing your Electron app (DMG files) - NOT for this!  
✅ **Vercel deploys automatically** from GitHub - you don't upload files manually

❌ **Don't put vercel.json anywhere** - you don't need it for this approach  
❌ **Don't use Releases** - Vercel deploys from your repo automatically  
❌ **Don't worry about the main repo** - this is completely separate

---

## That's It!

Once deployed, every time someone signs up, the API will send them an email automatically! ✅







