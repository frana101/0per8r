# Fix: Your Token Needs `repo` Scope

## The Problem

Your token is being used, but it doesn't have the `repo` scope, so GitHub is denying access (403 error).

## Quick Fix: Create New Token

### Step 1: Create New Token with `repo` Scope

1. Go to: **https://github.com/settings/tokens**
2. Click **"Generate new token (classic)"**
3. **Name:** `0per8r full access`
4. **Expiration:** Your choice (90 days, 1 year, or no expiration)
5. **IMPORTANT:** Scroll down and check:
   - ✅ **`repo`** (this is the main one - gives full repo access)
   - ✅ **`workflow`** (optional, but good to have)
6. Scroll down, click **"Generate token"**
7. **COPY THE NEW TOKEN** (starts with `ghp_...`)

### Step 2: Update Remote with New Token

Run this (replace `NEW_TOKEN` with the token you just copied):

```bash
cd "/Users/faiyaad/coding apps/focus app"
git remote set-url origin https://NEW_TOKEN@github.com/frana101/0per8r.git
```

**Example:**
```bash
git remote set-url origin https://ghp_abc123xyzNEW@github.com/frana101/0per8r.git
```

### Step 3: Push Again

```bash
git push -u origin main
```

Should work now! ✅

## Why This Happens

The old token probably:
- Was created without checking the `repo` box
- Or only had `public_repo` (not full `repo` access)
- Or expired

The new token with `repo` scope will have full access!

## After Pushing

Once code is pushed, you can publish releases:
```bash
GH_TOKEN=NEW_TOKEN npm run publish:mac
```

Use the same new token!









