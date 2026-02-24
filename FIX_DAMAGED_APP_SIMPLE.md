# Fix: "0per8r is damaged and can't be opened"

## Quick Fix (2 Methods)

### Method 1: Terminal Command (Fastest)

1. **Open Terminal**
2. **Run this command:**
   ```bash
   xattr -cr /Applications/0per8r.app
   ```
   (Replace `/Applications/0per8r.app` with wherever you installed it)

3. **Try opening again** - should work now!

### Method 2: Right-Click Method

1. **Right-click** on the 0per8r app
2. Click **"Open"** (not double-click)
3. Click **"Open"** in the warning dialog
4. App will open and remember this choice

### Method 3: System Settings (Permanent Fix)

1. Go to **System Settings** → **Privacy & Security**
2. Scroll down to **"Security"** section
3. If you see a message about 0per8r being blocked, click **"Open Anyway"**
4. Enter your password if asked

## Why This Happens

- macOS Gatekeeper blocks apps from unidentified developers
- Your app isn't code-signed (would cost $99/year)
- This is normal for free/indie apps
- The fix removes the quarantine flag

## For Users

You can include these instructions in your app documentation or README so users know how to fix it!

## Permanent Solution (Future)

To avoid this completely, you'd need to:
- Get Apple Developer account ($99/year)
- Code sign the app
- Notarize it with Apple

For now, the `xattr` command fix works perfectly!









