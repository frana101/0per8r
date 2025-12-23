# Auto-Updater Setup Guide

## ✅ Implementation Complete

The auto-updater has been implemented! The app will now:
- **Automatically check for updates** on startup and every 4 hours
- **Download updates in the background** when available
- **Show notifications** when updates are ready
- **Allow users to install** updates with one click

## 🔧 Configuration Required

### Step 1: Set Up GitHub Repository

1. Create a GitHub repository for your app
2. Update `package.json` with your repository info:

```json
"publish": {
  "provider": "github",
  "owner": "YOUR_GITHUB_USERNAME",
  "repo": "YOUR_REPO_NAME"
}
```

### Step 2: Get GitHub Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Create a token with `repo` permissions
3. Set it as environment variable:

```bash
export GH_TOKEN=your_token_here
```

Or add to your build command:
```bash
GH_TOKEN=your_token npm run build:mac
```

### Step 3: Build and Publish

When you build, electron-builder will automatically:
- Create release files
- Upload to GitHub Releases
- Create update metadata

```bash
npm run build:mac
# or
npm run build:win
```

## 📦 How It Works

1. **Check for Updates:**
   - On app startup (after 5 seconds)
   - Every 4 hours automatically
   - Can be manually triggered

2. **Download Updates:**
   - Downloads in background
   - Shows progress notification
   - Doesn't interrupt user workflow

3. **Install Updates:**
   - User sees notification when ready
   - Can click "Restart Now" to install
   - Or dismiss and install later

## 🎨 User Experience

- **Update Available:** Shows notification with "Download & Install" button
- **Downloading:** Shows progress bar with percentage
- **Ready to Install:** Shows "Restart Now" button
- **Error:** Shows error message (auto-dismisses after 5 seconds)

## 🔒 Security

- Updates are verified before installation
- Only signed updates can be installed (if you code sign)
- Downloads are checked for integrity

## 🚀 Publishing Updates

1. **Update version** in `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. **Build and publish:**
   ```bash
   GH_TOKEN=your_token npm run build:mac
   ```

3. **GitHub Release is created automatically** with:
   - DMG/EXE files
   - Update metadata (latest-mac.yml, latest-win.yml)
   - Release notes (from CHANGELOG.md if present)

## 📝 Alternative: Custom Update Server

If you don't want to use GitHub, you can:

1. Host update files on your own server
2. Update `publish` config:
   ```json
   "publish": {
     "provider": "generic",
     "url": "https://your-server.com/updates"
   }
   ```

## ⚠️ Important Notes

- **Code Signing:** For production, you should code sign your app
- **HTTPS Required:** Update server must use HTTPS
- **Version Numbers:** Must follow semantic versioning (1.0.0, 1.0.1, etc.)
- **First Release:** Users need to download the first version manually

## 🧪 Testing

To test the updater:

1. Build version 1.0.0 and install it
2. Update version to 1.0.1 in package.json
3. Build and publish version 1.0.1
4. Open version 1.0.0 - it should detect the update!

## 📚 Resources

- [electron-updater docs](https://www.electron.build/auto-update)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)

