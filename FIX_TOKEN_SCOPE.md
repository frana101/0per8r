# Fix: Token Has No Scopes (404 Error)

## The Problem

Your GitHub token has **NO scopes** (`x-oauth-scopes: ""`). It needs the `repo` scope to publish releases.

## The Solution: Create New Token with Correct Scopes

### Step 1: Create New Token

1. Go to: **https://github.com/settings/tokens**
2. Click **"Generate new token (classic)"**
3. **Name:** `0per8r publish`
4. **IMPORTANT:** Check the **`repo`** box (this gives full repository access)
5. Scroll down and click **"Generate token"**
6. **COPY THE TOKEN** (starts with `ghp_...`)

### Step 2: Verify Token Has Scopes

The token MUST have `repo` scope. When you create it, make sure:
- ✅ `repo` is checked
- ✅ Not just `public_repo` - you need full `repo` access

### Step 3: Try Publishing Again

```bash
cd "/Users/faiyaad/coding apps/focus app"
GH_TOKEN=your_new_token npm run publish:mac
```

## Alternative: Check if Repo Exists

The 404 might also mean the repo doesn't exist. Check:

1. Go to: **https://github.com/frana101/0per8r**
2. Does it exist? If not, create it first
3. Make sure it's not private (or your token has access)

## Quick Test

Test your token works:
```bash
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/repos/frana101/0per8r
```

If you get 404, either:
- Token has no scopes (create new one with `repo`)
- Repo doesn't exist (create it on GitHub)
- Token doesn't have access (check permissions)

## Summary

**The issue:** Token has no scopes
**The fix:** Create new token with `repo` scope checked
**Then:** Run publish command again









