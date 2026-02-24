# Simple Step-by-Step Guide

## Step 1: Create Repository on GitHub

1. Go to: **https://github.com/new**
2. **Repository name:** Type `0per8r` (exactly like that)
3. Make it **Public** (or Private - your choice)
4. **DO NOT** check "Add a README file" (you already have code)
5. Click the green **"Create repository"** button
6. **Done!** Don't do anything else on that page - just close it

## Step 2: Create Personal Access Token

**YES - use Personal Access Token (classic)!**

1. Go to: **https://github.com/settings/tokens**
2. Click the green button: **"Generate new token"**
3. Click: **"Generate new token (classic)"** (the classic one!)
4. **Name:** Type `0per8r publish`
5. **Expiration:** Choose how long (90 days, 1 year, or no expiration)
6. **IMPORTANT:** Scroll down and check the box: **`repo`**
   - This gives it permission to upload files
7. Scroll all the way down
8. Click green **"Generate token"** button
9. **COPY THE TOKEN** (it starts with `ghp_...`)
   - You'll only see it once! Save it somewhere safe.

## Step 3: Push Your Code (Upload Files to GitHub)

"Push your code" means uploading your app files to GitHub.

**Run these commands in Terminal:**

```bash
cd "/Users/faiyaad/coding apps/focus app"
git remote set-url origin https://YOUR_TOKEN@github.com/frana101/0per8r.git
git push -u origin main
```

**Replace `YOUR_TOKEN` with the token you copied!**

**Example:**
```bash
git remote set-url origin https://ghp_abc123xyz@github.com/frana101/0per8r.git
git push -u origin main
```

This uploads all your code files to GitHub.

## Step 4: Publish Release (Upload DMG Files)

After code is uploaded, publish the release:

```bash
GH_TOKEN=YOUR_TOKEN npm run publish:mac
```

**Replace `YOUR_TOKEN` with the same token!**

This uploads the DMG files for users to download.

## Summary

1. ✅ Create repo named `0per8r` on GitHub
2. ✅ Create **Personal Access Token (classic)** with `repo` scope
3. ✅ Push code: `git remote set-url...` then `git push`
4. ✅ Publish: `GH_TOKEN=... npm run publish:mac`

That's it!









