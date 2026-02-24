# Manual Web Upload (Works, Just Slower)

If you can't install Homebrew/GitHub CLI, manual upload works fine - it just takes 30 minutes per file.

## Steps:

### 1. Build Your App (Don't Publish)

```bash
cd "/Users/faiyaad/coding apps/focus app"
npm run build:mac
```

This creates DMG files in the `dist` folder.

### 2. Go to GitHub Releases

1. Go to: https://github.com/frana101/0per8r/releases
2. Click "Draft a new release" (or edit existing v1.1.5 if it exists)

### 3. Create/Edit Release

- **Tag**: `v1.1.5`
- **Title**: `0per8r v1.1.5`
- **Description**: `Version 1.1.5 - All features implemented`

### 4. Upload Files

1. Scroll down to "Attach binaries"
2. Drag and drop these files from `dist` folder:
   - `0per8r-1.1.5.dmg`
   - `0per8r-1.1.5-arm64.dmg`
   - `0per8r-1.1.5.dmg.blockmap`
   - `0per8r-1.1.5-arm64.dmg.blockmap`

3. Wait 30 minutes per file (unfortunately this is normal for large files)

4. Click "Publish release"

---

## Why It's Slow

- Files are 99-104MB each
- Web uploads are slower than API/CLI
- 30 minutes per file is normal for this size

## It Will Work!

Just be patient - the upload will complete, it just takes time.






