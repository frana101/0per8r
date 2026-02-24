# Fix "Damaged" Error - This is Normal!

## The "Damaged" Error is NOT a Real Problem

The "damaged" error is **macOS Gatekeeper** blocking unsigned apps. This is **normal** and **safe to fix**.

## Quick Fix (Do This Every Time)

### Method 1: Terminal Command (Fastest)

1. **Open Terminal**
2. **Find where you installed the app:**
   - If in Applications: `/Applications/0per8r.app`
   - If still in Downloads: `/Users/faiyaad/Downloads/0per8r.app`
   - If in DMG: Drag it to Applications first, then use `/Applications/0per8r.app`

3. **Run this command:**
   ```bash
   xattr -cr /Applications/0per8r.app
   ```
   (Replace path with wherever your app is)

4. **Try opening again** - should work! ✅

### Method 2: Right-Click

1. **Right-click** on the 0per8r app
2. Click **"Open"** (not double-click)
3. Click **"Open"** in the warning
4. Done!

## Do You Need to Publish?

### If You Just Built (Not Published):
- Files are in `dist/` folder
- **You can use these files directly**
- Still need to fix "damaged" error with `xattr`

### If You Published to GitHub:
- Files are on GitHub Releases
- **Download from there**
- Still need to fix "damaged" error with `xattr`

## The "Damaged" Error Will Always Happen

This is **normal** for unsigned apps. Every time you download/install:
1. macOS says "damaged"
2. Run `xattr -cr /path/to/app`
3. App works fine!

## For Your Users

Tell them to:
1. Download from GitHub Releases
2. Run: `xattr -cr /Applications/0per8r.app`
3. Open app - works!

Or include instructions in your README.

## Summary

- ✅ **"Damaged" error = Normal** (just run `xattr` command)
- ✅ **Build vs Publish:** Both work, but publishing is better for distribution
- ✅ **Every download needs the fix** (until you code-sign for $99/year)

The app is NOT actually damaged - it's just macOS being protective!









