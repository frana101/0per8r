# Next Steps - Auto-Updater Setup

## ✅ Repository Renamed
Your repo is now "0per8r" - perfect!

## What to Do Now

### Step 1: Get GitHub Token (One-Time Setup)

1. Go to: **https://github.com/settings/tokens**
2. Click **"Generate new token (classic)"**
3. Name it: `0per8r updates`
4. Check the box: **`repo`** (this gives permission to create releases)
5. Scroll down and click **"Generate token"**
6. **COPY THE TOKEN** - you'll only see it once!
   - It looks like: `ghp_xxxxxxxxxxxxxxxxxxxx`

### Step 2: Build and Publish First Release

Run this command (replace `YOUR_TOKEN` with the token you copied):

```bash
cd "/Users/faiyaad/coding apps/focus app"
GH_TOKEN=YOUR_TOKEN npm run build:mac
```

**Example:**
```bash
GH_TOKEN=ghp_abc123xyz npm run build:mac
```

This will:
- Build the app
- Create a GitHub Release automatically
- Upload the DMG file
- Set up auto-updates

### Step 3: Test It!

1. Download the DMG from your GitHub Releases page
2. Install it on your Mac
3. When you build version 1.0.1 later, version 1.0.0 will automatically detect it!

## Future Updates

When you want to release a new version:

1. **Update version** in `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. **Build with token:**
   ```bash
   GH_TOKEN=YOUR_TOKEN npm run build:mac
   ```

3. **Done!** Users will get notified automatically.

## Important Notes

- **Keep your token safe** - don't share it or commit it to GitHub
- **First release** - users still need to download manually from GitHub
- **After that** - all updates are automatic!

## To Run App (Development)

```bash
cd "/Users/faiyaad/coding apps/focus app"
npm start
```

