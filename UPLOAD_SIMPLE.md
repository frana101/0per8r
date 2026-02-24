# Simple Upload Instructions for v1.1.6

## Option 1: Manual Web Upload (Easiest - No Installation Needed)

### Step 1: Go to GitHub
1. Open: https://github.com/frana101/0per8r/releases
2. Click **"Draft a new release"** (or edit v1.1.6 if it exists)

### Step 2: Create Release
- **Tag**: `v1.1.6`
- **Title**: `0per8r v1.1.6`
- **Description**: 
  ```
  Version 1.1.6
  
  - Functional soundscape on/off toggle in main menu and focus mode
  - Users stay signed in after closing app
  - Logout button in top right corner
  - Improved authentication persistence
  ```

### Step 3: Upload Files
1. Open Finder
2. Navigate to: `/Users/faiyaad/coding apps/focus app/dist`
3. Drag and drop these files into the GitHub release page:
   - `0per8r-1.1.6.dmg` (~104MB - will take ~30 min)
   - `0per8r-1.1.6-arm64.dmg` (~99MB - will take ~30 min)
   - `0per8r-1.1.6.dmg.blockmap` (~112KB - fast)
   - `0per8r-1.1.6-arm64.dmg.blockmap` (~107KB - fast)

4. Wait for uploads to finish (30 minutes per DMG file)
5. Click **"Publish release"**

---

## Option 2: Install GitHub CLI (Faster Uploads)

If you want faster uploads from terminal:

### Install GitHub CLI
```bash
# First install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install GitHub CLI
brew install gh

# Authenticate
gh auth login
```

### Upload
```bash
cd "/Users/faiyaad/coding apps/focus app"

# Create release
gh release create v1.1.6 --title "0per8r v1.1.6" --notes "Version 1.1.6 - All features implemented"

# Upload files
gh release upload v1.1.6 dist/0per8r-1.1.6.dmg dist/0per8r-1.1.6-arm64.dmg dist/0per8r-1.1.6.dmg.blockmap dist/0per8r-1.1.6-arm64.dmg.blockmap
```

---

## Recommended: Use Option 1 (Manual Upload)

It's simpler and doesn't require installing anything. Just be patient - the uploads will complete!





