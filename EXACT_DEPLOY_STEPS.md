# EXACT STEPS TO DEPLOY EMAIL API

## What I've Prepared For You

✅ Created a zip file: `0per8r-email-api.zip` 
✅ Contains everything needed for Vercel deployment
✅ Ready to upload

---

## STEP-BY-STEP INSTRUCTIONS

### Step 1: Go to Vercel
1. Open your browser
2. Go to: **https://vercel.com**
3. Click **"Sign Up"** or **"Log In"** (use GitHub to sign in if you want)

### Step 2: Create New Project
1. Click **"Add New..."** button (top right)
2. Click **"Project"**

### Step 3: Upload Your Files
1. Look for **"Deploy"** section
2. Click **"Browse"** or drag & drop
3. Select the file: **`0per8r-email-api.zip`** (in your project folder)
4. OR click **"Deploy"** button and upload the zip

### Step 4: Configure Project
1. **Project Name**: Type `0per8r-email-api` (or any name you want)
2. **Framework Preset**: Select **"Other"** or leave default
3. **Root Directory**: Leave as is (`.`)
4. **Build Command**: Leave empty
5. **Output Directory**: Leave empty

### Step 5: Add Environment Variable (IMPORTANT!)
1. Before clicking "Deploy", look for **"Environment Variables"** section
2. Click **"Add"** or the **"+"** button
3. Fill in:
   - **Key**: `RESEND_API_KEY`
   - **Value**: (paste your Resend API key here - it starts with `re_...`)
4. Click **"Save"** or **"Add"**

### Step 6: Deploy
1. Click the big **"Deploy"** button
2. Wait 1-2 minutes for deployment

### Step 7: Get Your URL
1. After deployment completes, you'll see a success page
2. Your URL will be something like: `https://0per8r-email-api.vercel.app`
3. **COPY THIS URL** - you'll need it!

### Step 8: Test It (Optional)
1. Your API endpoint will be: `https://your-project.vercel.app/api/send-verification`
2. If you want to test, I can help you test it

### Step 9: Update App Code
Once you have the URL, tell me and I'll update `app.js` to use your new API URL!

---

## ALTERNATIVE: If You Want to Use GitHub Instead

If you prefer to deploy from GitHub:

1. Create a new GitHub repository (empty)
2. Upload these files to the repo:
   - `api/send-verification.js`
   - `vercel.json`
3. In Vercel, click "Import Git Repository"
4. Select your new repo
5. Add the `RESEND_API_KEY` environment variable
6. Deploy

---

## Need Help?

Just tell me which step you're on and I'll help! 🚀




