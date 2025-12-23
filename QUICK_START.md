# Quick Start Guide

## 🚀 Run the App

```bash
cd "/Users/faiyaad/coding apps/focus app"
npm start
```

That's it! The app will open.

---

## 📧 Email Setup (To Send Real Emails)

### Step 1: Get Resend API Key
1. Go to: **https://resend.com** (sign up - it's free)
2. Go to **"API Keys"**
3. Click **"Create API Key"**
4. Name it: `0per8r`
5. **COPY THE KEY** (starts with `re_...`)

### Step 2: Add Key to App
1. Run the app: `npm start`
2. Open Developer Tools: Press `F12` or `Cmd+Option+I`
3. Go to **"Console"** tab
4. Type this (replace with your key):
   ```javascript
   localStorage.setItem('0per8r_resend_api_key', 're_YOUR_KEY_HERE');
   ```
5. Press Enter
6. Now try signing up - emails will be sent!

---

## 📦 GitHub Releases (Where Your Builds Go)

### What Happened When You Built?
The build created files in the `dist/` folder:
- ✅ `0per8r-1.0.0.dmg` - For Macs
- ✅ `0per8r Setup 1.0.0.exe` - For Windows

### Did It Upload to GitHub?
**Check if it published:**
1. Go to: **https://github.com/frana101/0per8r/releases**
2. Do you see "v1.0.0" or "1.0.0"?
3. If YES → It worked! ✅
4. If NO → It didn't publish (but files are still in `dist/` folder)

### If It Didn't Publish:
**Option 1: Upload Manually**
1. Go to: **https://github.com/frana101/0per8r/releases**
2. Click **"Create a new release"**
3. Tag: `v1.0.0`
4. Title: `Version 1.0.0`
5. Drag the DMG file from `dist/` folder
6. Click **"Publish release"**

**Option 2: Rebuild with Token**
1. Get GitHub token: **https://github.com/settings/tokens**
2. Create token with `repo` permission
3. Run: `GH_TOKEN=your_token npm run build:mac`
4. Check output for "published" message

---

## 🔄 Auto-Updates

Once you publish to GitHub Releases:
- Users with old versions will see update notifications
- They can click "Download & Install"
- Updates happen automatically!

---

## 📝 Summary

**To run app:**
```bash
cd "/Users/faiyaad/coding apps/focus app" && npm start
```

**To build:**
```bash
cd "/Users/faiyaad/coding apps/focus app" && GH_TOKEN=your_token npm run build:mac
```

**Your files are in:** `dist/` folder

**GitHub Releases:** https://github.com/frana101/0per8r/releases
