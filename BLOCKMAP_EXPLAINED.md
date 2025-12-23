# What is a Block Map?

## Simple Answer

**Block maps are helper files for faster updates.** They're NOT the thing that updates your app.

## What They Do

- **Block maps** (`.blockmap` files) help the auto-updater download updates faster
- Instead of downloading the entire 100MB file again, it only downloads the parts that changed
- This makes updates much smaller and faster!

## Example

**Without block map:**
- User has version 1.0.0 (100 MB)
- You release 1.0.1 (100 MB)
- User downloads full 100 MB again

**With block map:**
- User has version 1.0.0 (100 MB)
- You release 1.0.1 (only 5 MB changed)
- User downloads only 5 MB! 🚀

## Do You Need to Upload Block Maps?

**Yes!** Upload them along with the DMG/EXE files:
- `0per8r-1.0.0.dmg` ✅
- `0per8r-1.0.0.dmg.blockmap` ✅
- `0per8r-1.0.0-arm64.dmg` ✅
- `0per8r-1.0.0-arm64.dmg.blockmap` ✅
- `0per8r Setup 1.0.0.exe` ✅
- `0per8r Setup 1.0.0.exe.blockmap` ✅

## What Actually Updates the App?

The **auto-updater code** I added to your app is what checks for and installs updates. The block maps just make it faster!

## Summary

- Block maps = helper files for faster updates
- Auto-updater code = the thing that actually updates
- Upload both DMG files AND their block maps
- Upload Windows EXE AND its block map

