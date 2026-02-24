# Fix: Files Too Large for GitHub Web Upload

## The Problem
GitHub web interface only allows files **under 25MB**. Your DMG/EXE files are ~100MB each.

## The Solution: Use Build Command (Automatic Upload)

**Don't upload manually!** Use the build command - it uploads via API (no size limit).

### Step 1: Get GitHub Token
1. Go to: **https://github.com/settings/tokens**
2. Create token with **`repo`** permission
3. Copy it

### Step 2: Build and Auto-Upload
Run this command (replace `YOUR_TOKEN`):

```bash
cd "/Users/faiyaad/coding apps/focus app"
GH_TOKEN=YOUR_TOKEN npm run build:mac
```

**This will:**
- Build the app
- **Automatically upload to GitHub Releases** (no 25MB limit!)
- Create the release for you
- Upload all files (DMG + blockmaps)

### Step 3: For Windows Too
```bash
GH_TOKEN=YOUR_TOKEN npm run build:win
```

Or build both:
```bash
GH_TOKEN=YOUR_TOKEN npm run build:all
```

## Why This Works

- **Web upload:** 25MB limit ❌
- **API upload (build command):** No limit ✅
- **Auto-updater:** Needs files on GitHub Releases ✅

## After Building

1. Go to: **https://github.com/frana101/0per8r/releases**
2. You should see the release with all files!
3. Auto-updater will now work!

## Summary

**Don't upload manually** - use the build command with token. It handles everything automatically!









