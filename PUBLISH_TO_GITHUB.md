# How to Publish to GitHub Releases

## What Happened

Your build **succeeded** ✅ but it **didn't publish** to GitHub because:
- The build command doesn't publish by default
- You need to add `--publish always` flag
- OR set the `GH_TOKEN` environment variable

## Solution: Use Publish Command

I've added new commands to `package.json`. Use these:

### For Mac:
```bash
cd "/Users/faiyaad/coding apps/focus app"
GH_TOKEN=your_token npm run publish:mac
```

### For Windows:
```bash
GH_TOKEN=your_token npm run publish:win
```

### For Both:
```bash
GH_TOKEN=your_token npm run publish:all
```

## What This Does

1. **Builds** the app (creates DMG/EXE files)
2. **Automatically uploads** to GitHub Releases
3. **Creates release** if it doesn't exist
4. **Uploads all files** (DMG + blockmaps)

## After Running

1. Go to: **https://github.com/frana101/0per8r/releases**
2. You should see **"v1.0.0"** with all files!
3. Auto-updater will now work! 🎉

## Quick Copy-Paste

Replace `your_token` with your actual GitHub token:

```bash
cd "/Users/faiyaad/coding apps/focus app"
GH_TOKEN=your_token npm run publish:mac
```

## If You Already Built (Files in dist/)

The files are already built! You can:
- **Option 1:** Use publish command (it will rebuild and upload)
- **Option 2:** Manually upload from `dist/` folder (but files are >25MB, so this won't work)

**Best:** Use the publish command - it handles everything!

