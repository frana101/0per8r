# 0per8r Installation Instructions

## For Mac Users

### If you see "0per8r is damaged and can't be opened"

This is a macOS security feature. The app is safe, but macOS blocks unsigned apps. Here's how to fix it:

#### Method 1: Right-Click Open (Easiest)
1. **Don't double-click** the app
2. **Right-click** (or Control+Click) on `0per8r.app`
3. Select **"Open"** from the menu
4. Click **"Open"** in the security dialog that appears
5. The app will now open and be trusted for future use

#### Method 2: System Settings
1. Go to **System Settings** (or System Preferences on older macOS)
2. Go to **Privacy & Security**
3. Scroll down to find a message about "0per8r" being blocked
4. Click **"Open Anyway"**
5. Confirm by clicking **"Open"**

#### Method 3: Remove Quarantine (Advanced)
Open Terminal and run:
```bash
xattr -cr /Applications/0per8r.app
```

### Installation Steps

1. **Download** the `.dmg` file
   - Use `0per8r-1.0.0-arm64.dmg` for Apple Silicon Macs (M1/M2/M3)
   - Use `0per8r-1.0.0.dmg` for Intel Macs

2. **Double-click** the `.dmg` file to open it

3. **Drag** `0per8r.app` to your **Applications** folder

4. **Open** the app:
   - Right-click → Open (first time only)
   - Or: System Settings → Privacy & Security → Open Anyway

5. **Done!** The app is now installed and trusted

### First Launch Notes

- The app will ask for **admin password** when you start a focus session
- This is required for system-level website blocking
- You can cancel, but blocking won't work without it

## For Windows Users

1. **Download** `0per8r Setup 1.0.0.exe`

2. **Double-click** the installer

3. **Follow** the installation wizard:
   - Choose installation location (default is fine)
   - Create desktop shortcut (recommended)
   - Create Start Menu shortcut (recommended)

4. **Launch** from Desktop or Start Menu

5. **Done!** The app is installed

### First Launch Notes

- Windows Defender may show a warning (app is unsigned)
- Click "More info" → "Run anyway"
- The app will ask for **admin privileges** when starting focus mode
- This is required for system-level blocking

## Troubleshooting

### macOS: "App can't be opened because it is from an unidentified developer"
- **Solution:** Use Method 1 or 2 above (Right-click Open or System Settings)

### macOS: App opens but immediately closes
- **Solution:** Check Console.app for error messages
- Make sure you're using the correct DMG for your Mac type (Intel vs Apple Silicon)

### Windows: "Windows protected your PC"
- **Solution:** Click "More info" → "Run anyway"
- This happens because the app isn't code-signed (requires a certificate)

### Both: App needs admin password but I don't have admin access
- **Solution:** You need admin/administrator privileges to use the blocking features
- Ask your IT administrator to install it, or use a personal computer

## Need Help?

If you continue to have issues:
1. Make sure you downloaded the correct file for your system
2. Try the right-click open method (macOS)
3. Check that you have admin/administrator privileges
4. Contact support with your operating system version

