# App Updates - Important Information

## Will Updates Automatically Update?

**Short Answer: No, not by default.**

Electron apps are desktop applications, not web apps. They don't automatically update unless you implement an auto-updater.

## Current Situation

- **Your downloaded app:** Stays at the version you downloaded
- **Code changes I make:** Only affect your development version (when you run `npm start`)
- **Built apps (.dmg/.exe):** Won't update automatically

## How to Enable Auto-Updates

To make the app automatically update, you would need to:

1. **Implement electron-updater:**
   ```bash
   npm install electron-updater
   ```

2. **Set up an update server** (like GitHub Releases, or your own server)

3. **Add update checking code** to `main.js`

4. **Configure build** to publish updates

This requires:
- A server to host update files
- Code signing (for macOS/Windows to trust updates)
- Update infrastructure

## For Now

Users will need to:
1. Download new versions manually
2. Replace the old app with the new one
3. Or re-run the installer

## Future Recommendation

If you want auto-updates, consider:
- **GitHub Releases** (free, easy)
- **Electron Forge** (built-in auto-update support)
- **Custom update server** (more control)

Let me know if you want me to implement auto-updates!

