# Create GitHub Repo and Deploy to Vercel

## Step 1: Create GitHub Repository

1. Go to: **https://github.com/new**
2. **Repository name**: `0per8r-email-api`
3. Description: `Email verification API for 0per8r`
4. Make it **Public** or **Private** (doesn't matter)
5. **DO NOT** check "Add README" or any other files
6. Click **"Create repository"**

## Step 2: Push Files to GitHub

I've prepared the files in the `DEPLOY_READY` folder. Run these commands:

```bash
cd "/Users/faiyaad/coding apps/focus app/DEPLOY_READY"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/0per8r-email-api.git
git push -u origin main
```

**Replace `YOUR_USERNAME` with your GitHub username!**

### OR if you already have GitHub CLI:

```bash
cd "/Users/faiyaad/coding apps/focus app/DEPLOY_READY"
gh repo create 0per8r-email-api --public --source=. --remote=origin --push
```

## Step 3: Import to Vercel

1. Go back to: **https://vercel.com**
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Find and select: **`0per8r-email-api`**
5. Click **"Import"**

## Step 4: Configure in Vercel

1. **Project Name**: `0per8r-email-api` (or leave default)
2. **Framework Preset**: Other (or leave default)
3. **Root Directory**: Leave as `.` (default)
4. **Build Command**: Leave empty
5. **Output Directory**: Leave empty

## Step 5: Add Environment Variable (CRITICAL!)

1. Before deploying, find **"Environment Variables"** section
2. Click **"Add"** or **"+"**
3. Add:
   - **Key**: `RESEND_API_KEY`
   - **Value**: (paste your Resend API key - starts with `re_...`)
4. Click **"Add"** or **"Save"**

## Step 6: Deploy

1. Click **"Deploy"**
2. Wait 1-2 minutes

## Step 7: Get Your URL

After deployment, copy your URL (e.g., `https://0per8r-email-api.vercel.app`)
Tell me this URL and I'll update your app code!




