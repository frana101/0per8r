# Quick Upload for v1.1.7

## One Command (Builds + Uploads Everything):

```bash
cd "/Users/faiyaad/coding apps/focus app" && ./UPLOAD_1.1.7.sh
```

This will:
1. Build macOS version
2. Build Windows version  
3. Create GitHub release v1.1.7
4. Upload all files automatically

---

## What Was Fixed in v1.1.7:

✅ **Soundscape Toggle**: Now properly toggles ON/OFF when clicked
- Fixed event listener issues
- Buttons now correctly alternate between ON and OFF states
- Works in both main menu and focus mode

✅ **Stay Signed In**: Users now stay signed in after quitting app
- Session persists for 30 days
- Authentication state properly restored on app startup
- No need to sign in every time

---

## Manual Upload (If Script Doesn't Work):

```bash
cd "/Users/faiyaad/coding apps/focus app"

# Build
npm run build:mac
npm run build:win

# Upload
/opt/homebrew/bin/gh release create v1.1.7 --title "0per8r v1.1.7" --notes "Version 1.1.7 - Fixed soundscape toggle and authentication persistence" dist/0per8r-1.1.7.dmg dist/0per8r-1.1.7-arm64.dmg "dist/0per8r Setup 1.1.7.exe" dist/*.blockmap
```





