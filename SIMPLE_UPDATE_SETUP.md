# Simple Auto-Update Setup

## What You Need to Do (3 Steps)

### Step 1: Make Sure Your GitHub Repo Exists
- Your repository is called "focus app" on GitHub
- Make sure it's public (or you have a GitHub token with access)

### Step 2: Update package.json
Change the repo name in `package.json` to match your actual GitHub repo:

```json
"publish": {
  "provider": "github",
  "owner": "frana101",
  "repo": "focus-app"  // or whatever your repo is actually called
}
```

### Step 3: Build and Publish
When you want to release an update:

1. **Update the version number** in `package.json`:
   ```json
   "version": "1.0.1"  // Change from 1.0.0 to 1.0.1
   ```

2. **Get a GitHub token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Give it a name like "0per8r updates"
   - Check the `repo` box
   - Click "Generate token"
   - Copy the token (you'll only see it once!)

3. **Build with the token:**
   ```bash
   GH_TOKEN=your_token_here npm run build:mac
   ```
   
   Replace `your_token_here` with the token you copied.

4. **That's it!** The build will automatically:
   - Create a GitHub Release
   - Upload the DMG file
   - Create update metadata

## How Users Get Updates

Once you publish version 1.0.1:
- Users with version 1.0.0 will see a notification
- They click "Download & Install"
- The app downloads and installs automatically
- They click "Restart Now" to finish

## First Time Setup

For the FIRST release (1.0.0):
- Users still need to download manually from your GitHub Releases page
- After that, all future updates are automatic!

## To Run the App (Development)

```bash
npm start
```

That's it! Simple.

