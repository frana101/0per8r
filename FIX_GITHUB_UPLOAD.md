# Fix GitHub Upload Issues

## The Problem

GitHub has file size limits:
- **API uploads**: Max 2GB per file, but **100MB is recommended maximum**
- Large files (>100MB) often fail or timeout
- DMG files are typically 80-150MB, which can cause issues

## Solutions

### Option 1: Use GitHub CLI (Recommended - Fastest)

This bypasses the API and uploads directly:

```bash
# Install GitHub CLI if needed
brew install gh

# Login to GitHub
gh auth login

# Build the app first (without publishing)
npm run build:mac

# Create release and upload manually
gh release create v1.1.5 \
  --title "v1.1.5" \
  --notes "Version 1.1.5" \
  dist/*.dmg \
  dist/*.blockmap
```

This is MUCH faster (usually 1-2 minutes instead of 30).

### Option 2: Use `gh` to Upload After Publishing

If electron-builder creates the release but fails to upload:

```bash
# 1. Build and publish (creates release but upload might fail)
npm run publish:mac

# 2. Upload files manually using gh
gh release upload v1.1.5 dist/*.dmg dist/*.blockmap --clobber
```

### Option 3: Check GH_TOKEN and File Sizes

Make sure your token has proper permissions:

```bash
# Check token
echo $GH_TOKEN | head -c 20

# If not set, create one:
# 1. Go to GitHub.com → Settings → Developer settings → Personal access tokens
# 2. Generate token with "repo" scope
# 3. Set it:
export GH_TOKEN=your_token_here

# Add to ~/.zshrc to make permanent:
echo 'export GH_TOKEN=your_token_here' >> ~/.zshrc
```

### Option 4: Upload via Web Interface (Slow but Works)

If all else fails:
1. Build without publishing: `npm run build:mac`
2. Go to GitHub Releases page
3. Create new release manually
4. Drag and drop DMG files
5. Wait 30 minutes (unfortunately this is normal for large files)

### Option 5: Split or Compress Files

Reduce file size:
- Use `--compression=maximum` in electron-builder
- Remove unnecessary files from the app
- Consider code signing (can reduce size slightly)

## Recommended: Use GitHub CLI

**This is the fastest and most reliable method:**

```bash
# 1. Build (don't publish)
npm run build:mac

# 2. Upload using gh CLI
gh release create v1.1.5 \
  --title "0per8r v1.1.5" \
  --notes "Version 1.1.5 - All features implemented" \
  dist/*.dmg \
  dist/*.blockmap
```

This should take 1-2 minutes instead of 30!






