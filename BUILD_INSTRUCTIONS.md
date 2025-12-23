# Building 0per8r - Executable Files

## Prerequisites

1. **Exit Focus Mode** - The build process needs internet access to download Electron binaries
2. Make sure you have Node.js installed: `node --version`
3. Make sure dependencies are installed: `npm install`

## Building for macOS

### Option 1: Build DMG Installer (Recommended)
```bash
npm run build:mac
```

This creates a `.dmg` file in the `dist` folder that can be shared with any Mac user.

### Option 2: Build .app Bundle Only
You can modify the build config to create just the `.app` file instead of a DMG.

**Output Location:** `dist/0per8r-1.0.0.dmg`

**To share:** Send the `.dmg` file to any Mac user. They can:
1. Double-click the `.dmg` file
2. Drag `0per8r.app` to their Applications folder
3. Open it from Applications

## Building for Windows

### On macOS (Cross-compile)
```bash
npm run build:win
```

**Output Location:** `dist/0per8r Setup 1.0.0.exe`

### On Windows
1. Install Node.js on Windows
2. Copy the project folder to Windows
3. Run `npm install`
4. Run `npm run build:win`

**To share:** Send the `.exe` installer file. Users can:
1. Double-click the installer
2. Follow the installation wizard
3. Launch from Start Menu or Desktop shortcut

## Building Both Platforms

```bash
npm run build:all
```

## Important Notes

### Data Storage
- The app stores user data in `localStorage` (browser storage)
- Each installation will have its own data
- Data is stored locally on each machine

### "App is Damaged" Error (macOS)

If users see "0per8r is damaged and can't be opened", this is macOS Gatekeeper blocking unsigned apps. **Solutions:**

**Option 1 - Terminal (Easiest):**
```bash
xattr -cr /Applications/0per8r.app
```

**Option 2 - Right-Click:**
1. Right-click the app → Select "Open"
2. Click "Open" in the warning dialog

**Option 3 - System Preferences:**
1. System Preferences → Security & Privacy
2. Click "Open Anyway" if shown

### Code Signing (Optional)
For distribution without warnings, you would need to code sign:
- **macOS:** Requires Apple Developer account ($99/year)
- **Windows:** Requires code signing certificate

Without code signing, users need to use one of the solutions above the first time they open the app.

## Troubleshooting

### Build fails with network error
- **Solution:** Exit focus mode first, then build
- The build process needs to download Electron binaries

### "Unidentified developer" warning (macOS)
- **Solution:** Right-click the app → Open → Click "Open" in the dialog
- Or: System Preferences → Security & Privacy → Allow the app

### Windows build fails
- Make sure you're on Windows or have Wine installed for cross-compilation
- Some native modules may need Windows-specific builds

## File Sizes

- **macOS DMG:** ~150-200 MB
- **Windows Installer:** ~150-200 MB
- **Unpacked .app/.exe:** ~200-300 MB

These sizes are normal for Electron apps as they include the Chromium browser engine.

