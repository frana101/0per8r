# How to Organize GitHub Releases

## Answer: Put EVERYTHING in ONE Release! ✅

### What to Upload Together

**One release should have:**
1. `0per8r-1.0.0.dmg` (Intel Mac)
2. `0per8r-1.0.0.dmg.blockmap` (Intel Mac helper)
3. `0per8r-1.0.0-arm64.dmg` (Apple Silicon Mac)
4. `0per8r-1.0.0-arm64.dmg.blockmap` (Apple Silicon helper)
5. `0per8r Setup 1.0.0.exe` (Windows)
6. `0per8r Setup 1.0.0.exe.blockmap` (Windows helper)

**All in the SAME release!**

## Why One Release?

- **Auto-updater automatically picks the right file** for each user's platform
- Mac users get Mac files, Windows users get Windows files
- Cleaner and easier to manage
- One version number for all platforms

## How to Upload All Files

1. Go to: **https://github.com/frana101/0per8r/releases**
2. Click **"Create a new release"**
3. **Tag:** `v1.0.0`
4. **Title:** `Version 1.0.0`
5. **Drag ALL 6 files** into the upload area:
   - Hold `Cmd` and click all files
   - Or drag them one by one (wait for each to finish)
6. All files should appear in the list
7. Click **"Publish release"**

## File List for Reference

From your `dist/` folder, upload:
- ✅ `0per8r-1.0.0.dmg`
- ✅ `0per8r-1.0.0.dmg.blockmap`
- ✅ `0per8r-1.0.0-arm64.dmg`
- ✅ `0per8r-1.0.0-arm64.dmg.blockmap`
- ✅ `0per8r Setup 1.0.0.exe`
- ✅ `0per8r Setup 1.0.0.exe.blockmap`

## What Users See

- **Mac users:** See and download the DMG files
- **Windows users:** See and download the EXE file
- **Auto-updater:** Automatically picks the right one!

## Summary

**One release = All platforms = Better organization!**

Put everything together in one release. The auto-updater is smart enough to pick the right file for each user.

