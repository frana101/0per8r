# Fix: Publishing Issue

## The Problem

Version `v1.0.1` already exists on GitHub as a **release**, but electron-builder tried to create it as a **draft**. They conflict!

## Solution 1: Delete Existing Release and Re-publish (Recommended)

1. Go to: **https://github.com/frana101/0per8r/releases**
2. Find **v1.0.1**
3. Click **"Edit release"** or **"Delete"**
4. Delete it
5. Run publish again:
   ```bash
   GH_TOKEN=your_token npm run publish:mac
   ```

## Solution 2: Update to New Version (Easier)

1. In `package.json`, change version to `1.0.2`:
   ```json
   "version": "1.0.2"
   ```

2. Rebuild and publish:
   ```bash
   GH_TOKEN=your_token npm run publish:mac
   ```

This creates a fresh `v1.0.2` release!

## Solution 3: Use Existing Files

The files are already built in `dist/` folder:
- `0per8r-1.0.1.dmg`
- `0per8r-1.0.1-arm64.dmg`
- Blockmaps

You can manually upload them to the existing v1.0.1 release on GitHub.

## Recommendation

**Use Solution 2** - just bump to 1.0.2. Quick and easy!









