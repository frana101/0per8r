# Fix: 403 Permission Denied Error

## The Problem

The token either:
- Doesn't have the right scopes
- Isn't being used correctly
- Has expired

## Solution: Fix Token Authentication

### Option 1: Use Token in Remote URL (Easiest)

1. **Get your token** (make sure it has `repo` scope)
2. **Update remote with token:**

```bash
cd "/Users/faiyaad/coding apps/focus app"
git remote set-url origin https://YOUR_TOKEN@github.com/frana101/0per8r.git
```

**Replace `YOUR_TOKEN` with your actual token!**

**Example:**
```bash
git remote set-url origin https://ghp_abc123xyz456@github.com/frana101/0per8r.git
```

3. **Then push:**
```bash
git push -u origin main
```

### Option 2: Use GitHub CLI (Alternative)

If token doesn't work, use GitHub CLI:

```bash
# Install GitHub CLI (if not installed)
brew install gh

# Login
gh auth login

# Then push normally
git push -u origin main
```

### Option 3: Create New Token with ALL Scopes

1. Go to: **https://github.com/settings/tokens**
2. Create **new token (classic)**
3. Check **ALL** these boxes:
   - ✅ `repo` (full control of private repositories)
   - ✅ `workflow` (update GitHub Action workflows)
4. Generate and copy
5. Use in remote URL as shown in Option 1

## Verify Token Works

Test your token:
```bash
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
```

Should return your user info, not an error.

## Common Issues

**Issue:** Token has no scopes
**Fix:** Create new token, make sure `repo` is checked

**Issue:** Token expired
**Fix:** Create new token

**Issue:** Wrong token format
**Fix:** Make sure it starts with `ghp_` and you're using it correctly

## Quick Fix Command

Run this (replace with your token):
```bash
cd "/Users/faiyaad/coding apps/focus app"
git remote set-url origin https://YOUR_TOKEN@github.com/frana101/0per8r.git
git push -u origin main
```

If it still fails, create a NEW token with `repo` scope and try again!









