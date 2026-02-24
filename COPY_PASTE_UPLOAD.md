# Copy-Paste Upload Instructions

## Step 1: Make sure you're in the right directory

Copy and paste this into terminal:

```bash
cd "/Users/faiyaad/coding apps/focus app"
```

## Step 2: Check if GitHub CLI is working

```bash
gh --version
```

**If it says "command not found":**
1. Close and reopen your terminal (this loads the PATH)
2. Or run: `source ~/.zshrc` (or `source ~/.bash_profile` if using bash)
3. Try `gh --version` again

**If it still doesn't work:**
- You might need to restart your terminal app completely
- Or use manual web upload (see below)

## Step 3: Authenticate (first time only)

```bash
gh auth login
```

Follow the prompts:
- Choose "GitHub.com"
- Choose "HTTPS"
- Choose "Login with a web browser"
- Copy the code and press Enter
- Authorize in your browser

## Step 4: Upload files

```bash
cd "/Users/faiyaad/coding apps/focus app"

gh release create v1.1.6 \
  --title "0per8r v1.1.6" \
  --notes "Version 1.1.6 - All features implemented" \
  dist/0per8r-1.1.6.dmg \
  dist/0per8r-1.1.6-arm64.dmg \
  dist/0per8r-1.1.6.dmg.blockmap \
  dist/0per8r-1.1.6-arm64.dmg.blockmap
```

---

## Alternative: Manual Web Upload (If CLI doesn't work)

1. Go to: https://github.com/frana101/0per8r/releases
2. Click "Draft a new release"
3. Tag: `v1.1.6`, Title: `0per8r v1.1.6`
4. Open Finder: `open "/Users/faiyaad/coding apps/focus app/dist"`
5. Drag the 4 files (ending in 1.1.6) into GitHub
6. Wait 30 min per DMG file
7. Click "Publish release"





