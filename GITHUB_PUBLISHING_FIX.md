# GitHub Publishing Fix - Reliable Terminal Uploads

## The Problem
Files show 100% upload instantly but don't actually appear on GitHub. This is usually due to:
1. Missing or incorrect `GH_TOKEN` environment variable
2. Large file sizes (99-104MB) hitting GitHub API limits
3. Network timeout issues

## Solution: Use GitHub CLI (Recommended)

The most reliable way is to use GitHub CLI (`gh`) which handles large files better:

### 1. Install GitHub CLI (if not already installed)
```bash
# Check if installed
gh --version

# If not installed, install Homebrew first, then:
brew install gh

# Authenticate
gh auth login
```

### 2. Build Without Publishing
```bash
npm run build:mac
```

### 3. Upload Using GitHub CLI
```bash
# Create or update release
gh release create v1.1.6 --title "0per8r v1.1.6" --notes "Version 1.1.6 - All features implemented" || gh release edit v1.1.6 --title "0per8r v1.1.6" --notes "Version 1.1.6 - All features implemented"

# Upload files
gh release upload v1.1.6 dist/*.dmg dist/*.blockmap
```

## Alternative: Set GH_TOKEN Properly

If you want to use electron-builder's built-in publishing:

### 1. Create GitHub Personal Access Token
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name: "0per8r Publishing"
4. Scopes: Check `repo` (full control of private repositories)
5. Generate and copy the token

### 2. Set Environment Variable
```bash
# For current terminal session
export GH_TOKEN=your_token_here

# To make it permanent (add to ~/.zshrc)
echo 'export GH_TOKEN=your_token_here' >> ~/.zshrc
source ~/.zshrc
```

### 3. Verify Token
```bash
gh api user
# Should show your GitHub username, not "Bad credentials"
```

### 4. Publish
```bash
npm run publish:mac
```

## Why Manual Upload Works But Terminal Doesn't

- **Manual upload**: Uses web interface, handles large files with progress tracking
- **Terminal upload**: Uses GitHub API which has stricter limits and timeouts
- **GitHub CLI**: Best of both - uses API but handles large files better with retries

## Recommended Approach

**Use GitHub CLI** - it's the most reliable for large files and gives you progress feedback.





