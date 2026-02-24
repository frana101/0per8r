# Simple Guide: Deploy Email API

## What You're Doing
You're creating a separate small project (just the email API) and putting it on Vercel so emails can be sent.

---

## EASIEST WAY (Recommended)

### 1. Create New Folder on Your Computer

```bash
# Open Terminal and run:
cd ~/Desktop  # or wherever you want
mkdir 0per8r-email-api
cd 0per8r-email-api
mkdir api
```

### 2. Copy the API File

- Go to your main project: `/Users/faiyaad/coding apps/focus app/api/send-verification.js`
- Copy that file
- Paste it into: `~/Desktop/0per8r-email-api/api/send-verification.js`

### 3. Create package.json

In the `0per8r-email-api` folder, create a file called `package.json`:

```json
{
  "name": "0per8r-email-api",
  "version": "1.0.0"
}
```

### 4. Push to GitHub

In Terminal (in the `0per8r-email-api` folder):

```bash
git init
git add .
git commit -m "Initial commit"
```

Then:
1. Go to https://github.com/new
2. Create a new repo called `0per8r-email-api`
3. Don't check "Initialize with README"
4. Copy the commands GitHub shows (looks like):
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/0per8r-email-api.git
   git branch -M main
   git push -u origin main
   ```
5. Run those commands in Terminal

### 5. Deploy to Vercel

1. Go to https://vercel.com
2. Sign up (use "Continue with GitHub")
3. Click "Add New Project"
4. Find `0per8r-email-api` and click "Import"
5. Click "Deploy"
6. Wait for it to finish
7. After it's done:
   - Click on your project
   - Go to **Settings** → **Environment Variables**
   - Click "Add New"
   - Name: `RESEND_API_KEY`
   - Value: (paste your Resend API key from resend.com)
   - Click "Save"
8. Go to **Deployments** tab
9. Click the three dots (⋯) on the latest deployment → "Redeploy"

### 6. Copy Your URL

After redeploy, you'll see a URL like:
`https://0per8r-email-api-abc123.vercel.app`

Your API endpoint is:
`https://0per8r-email-api-abc123.vercel.app/api/send-verification`

### 7. Update Your App

1. Open your main project
2. Open `app.js`
3. Find this line (around line 1114):
   ```javascript
   const backendUrl = 'https://0per8r-email.vercel.app/send-verification';
   ```
4. Change it to your actual URL:
   ```javascript
   const backendUrl = 'https://0per8r-email-api-abc123.vercel.app/api/send-verification';
   ```

---

## FAQ

**Q: Where does vercel.json go?**
A: You don't need it for the separate repo approach! Skip it.

**Q: Do I put this in Releases?**
A: No! Releases are for your Electron app (DMG files). Vercel deploys automatically from your GitHub repo.

**Q: What if I want everything in one repo?**
A: That's more complex. Use the separate repo approach - it's much easier and avoids build errors.

**Q: Do I need to manually upload files to Vercel?**
A: No! Vercel automatically deploys from your GitHub repo. You just push code to GitHub, and Vercel deploys it automatically.

---

## Summary

1. Create new folder → copy API file → push to new GitHub repo
2. Deploy that repo to Vercel → add environment variable
3. Copy the URL → update app.js

That's it! ✅







