# Step-by-Step Guide

## Part 1: GitHub Releases (Where to Find It)

### What is GitHub Releases?
- It's a section in your GitHub repo where you publish versions of your app
- Like "v1.0.0", "v1.0.1", etc.

### How to See It:
1. Go to: **https://github.com/frana101/0per8r**
2. Look at the top of the page
3. Click **"Releases"** (next to "Code", "Issues", "Pull requests")
4. Or go directly: **https://github.com/frana101/0per8r/releases**

### If You Don't See It:
- It might not exist yet (first time)
- After you build with the token, it will create the first release automatically

## Part 2: Build and Publish (Do This)

### Step 1: Get GitHub Token
1. Go to: **https://github.com/settings/tokens**
2. Click **"Generate new token (classic)"**
3. Name: `0per8r updates`
4. Check: **`repo`** box
5. Click **"Generate token"**
6. **COPY IT** (starts with `ghp_...`)

### Step 2: Build with Token
Open Terminal and run:

```bash
cd "/Users/faiyaad/coding apps/focus app"
GH_TOKEN=YOUR_TOKEN_HERE npm run build:mac
```

**Replace `YOUR_TOKEN_HERE` with the token you copied**

**What happens:**
- It will build for 2-3 minutes
- You'll see lots of text scrolling
- At the end, it should say something like "published" or "release created"
- If you see errors, that's okay - check the end of the output

### Step 3: Check GitHub
1. Go to: **https://github.com/frana101/0per8r/releases**
2. You should see "v1.0.0" with a DMG file
3. If you see it, it worked! ✅

## Part 3: Real Email Verification

I'll set this up using Resend (free email service). Here's what you need to do:

### Step 1: Sign Up for Resend
1. Go to: **https://resend.com**
2. Sign up (free)
3. Verify your email
4. Go to **API Keys** section
5. Click **"Create API Key"**
6. Name it: `0per8r`
7. **COPY THE API KEY** (starts with `re_...`)

### Step 2: Add to Your App
I'll update the code to use Resend. You'll need to:
1. Add your API key to the code (I'll show you where)
2. The app will send real emails!

### Step 3: Verify Domain (Optional)
- For production, you'll want to verify your domain
- For testing, Resend lets you send to your own email first

## Quick Commands

**Run app:**
```bash
cd "/Users/faiyaad/coding apps/focus app" && npm start
```

**Build for Mac:**
```bash
cd "/Users/faiyaad/coding apps/focus app" && GH_TOKEN=your_token npm run build:mac
```

**Build for Windows:**
```bash
cd "/Users/faiyaad/coding apps/focus app" && GH_TOKEN=your_token npm run build:win
```

