# Step-by-Step: Deploy Email API to Vercel

## Understanding What Happens

- **Vercel** = A hosting service (like GitHub Pages, but for backend APIs)
- **GitHub** = Where your code lives
- **Vercel connects to GitHub** = Vercel watches your GitHub repo and automatically deploys when you push code

## Option 1: Deploy API Separately (RECOMMENDED - Easier)

This means creating a NEW GitHub repo with JUST the API files, then deploying that to Vercel.

### Step 1: Create New GitHub Repo

1. Go to https://github.com/new
2. Repository name: `0per8r-email-api` (or any name you want)
3. Make it **Public** or **Private** (doesn't matter)
4. Click "Create repository"
5. **Don't** initialize with README

### Step 2: Create Files on Your Computer

1. On your computer, create a new folder:
   ```bash
   mkdir 0per8r-email-api
   cd 0per8r-email-api
   ```

2. Inside this folder, create a folder called `api`:
   ```bash
   mkdir api
   ```

3. Copy the API file:
   - Copy `api/send-verification.js` from your main project
   - Paste it into `0per8r-email-api/api/send-verification.js`

4. Create a simple `package.json` in the root:
   ```json
   {
     "name": "0per8r-email-api",
     "version": "1.0.0"
   }
   ```

5. Create a `README.md` (optional):
   ```
   # 0per8r Email API
   Email verification API endpoint
   ```

### Step 3: Push to GitHub

1. Open Terminal in the `0per8r-email-api` folder

2. Run these commands:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/0per8r-email-api.git
   git push -u origin main
   ```
   (Replace `YOUR_USERNAME` with your actual GitHub username)

### Step 4: Deploy to Vercel

1. Go to https://vercel.com
2. Sign up/Login (use "Continue with GitHub")
3. Click "Add New Project"
4. Find `0per8r-email-api` in the list
5. Click "Import"
6. Click "Deploy" (don't change any settings yet)
7. Wait for it to deploy
8. After deployment, go to:
   - **Settings** → **Environment Variables**
   - Click "Add New"
   - Name: `RESEND_API_KEY`
   - Value: (paste your Resend API key)
   - Click "Save"
9. Go to **Deployments** tab
10. Click the three dots (⋯) on the latest deployment
11. Click "Redeploy" (this applies the environment variable)

### Step 5: Get Your URL

1. After redeploy, you'll see a URL like: `https://0per8r-email-api.vercel.app`
2. Your API endpoint is: `https://0per8r-email-api.vercel.app/api/send-verification`
3. Copy this URL

### Step 6: Update Your App

1. Open your main project (the Electron app)
2. Open `app.js`
3. Find line ~1114 that says:
   ```javascript
   const backendUrl = 'https://0per8r-email.vercel.app/send-verification';
   ```
4. Change it to:
   ```javascript
   const backendUrl = 'https://YOUR_PROJECT_NAME.vercel.app/api/send-verification';
   ```
   (Replace `YOUR_PROJECT_NAME` with your actual Vercel project name)

---

## Option 2: Deploy from Main Repo (More Complex)

If you want everything in one repo:

### Step 1: Commit vercel.json to Your Main Repo

1. `vercel.json` should already be in your main project folder
2. Make sure it's committed to GitHub:
   ```bash
   cd "/Users/faiyaad/coding apps/focus app"
   git add vercel.json
   git commit -m "Add vercel.json for API deployment"
   git push
   ```

3. Also make sure `.vercelignore` is committed (so Vercel ignores Electron files)

### Step 2: Deploy to Vercel

1. Go to https://vercel.com
2. Click "Add New Project"
3. Import your main `0per8r` repo
4. In project settings:
   - **Root Directory**: Leave as `/`
   - **Build Command**: Leave empty or delete it
   - **Output Directory**: Leave empty
5. Go to **Environment Variables**:
   - Add `RESEND_API_KEY` = (your key)
6. Deploy!

**Note**: This might still have issues because Vercel will see the Electron dependencies. Option 1 is recommended.

---

## What Goes Where?

- **GitHub Repos**: Your code storage (like Dropbox for code)
- **Vercel**: Hosting service that runs your API
- **Releases on GitHub**: For distributing your Electron app (DMG files) - NOT for Vercel
- **Vercel deploys from your GitHub repo automatically** - every time you push code, Vercel redeploys

You don't upload files to Vercel manually - you push to GitHub, and Vercel automatically deploys from GitHub.







