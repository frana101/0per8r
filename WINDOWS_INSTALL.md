# Windows Installation Guide for 0per8r

## Windows SmartScreen Warning

When you first download and try to run 0per8r on Windows, you may see a **Windows Defender SmartScreen** warning that says:

> "Windows protected your PC"  
> "Microsoft Defender SmartScreen prevented an unrecognized app from starting."

This is **normal** for unsigned applications. 0per8r is safe to use, but it hasn't been code-signed (which requires a paid certificate).

## How to Bypass SmartScreen Warning

### Method 1: "More info" Button (Recommended)

1. When you see the SmartScreen warning, click **"More info"** at the bottom
2. You'll see an option to **"Run anyway"** - click it
3. The app will launch normally

### Method 2: Right-Click Properties

1. Right-click the installer file (`.exe`)
2. Select **"Properties"**
3. At the bottom, check **"Unblock"** if available
4. Click **"OK"**
5. Run the installer again

### Method 3: Windows Security Settings (Temporary)

1. Open **Windows Security** (search in Start menu)
2. Go to **"App & browser control"**
3. Under **"Check apps and files"**, select **"Warn"** (instead of "Block")
4. Run the installer
5. **Important:** Change this back to "Block" after installation for security

## After Installation

Once installed, the app should run normally. You may still see a SmartScreen warning the first time you launch it - just click "More info" → "Run anyway" again.

## Why This Happens

- Windows SmartScreen protects users from potentially harmful software
- Unsigned apps (apps without a code-signing certificate) trigger this warning
- Code-signing certificates cost money ($200-400/year), so many free/open-source apps don't have them
- This is **not** a virus or malware - it's just Windows being cautious

## System Requirements

- Windows 10 or later
- Administrator privileges (required for system-wide website blocking)
- Internet connection (for updates)

## Installation Steps

1. Download the `.exe` installer from GitHub releases
2. If you see SmartScreen warning, follow the bypass steps above
3. Run the installer
4. Follow the installation wizard
5. Launch 0per8r from the Start menu or desktop shortcut

## Troubleshooting

**If the app won't start:**
- Make sure you clicked "Run anyway" when prompted
- Check Windows Security settings aren't blocking it
- Try running as Administrator

**If website blocking doesn't work:**
- The app requires Administrator privileges for system-wide blocking
- You'll be prompted for admin password when starting a focus session
- If you cancel the password prompt, only app-level blocking will work

## Uninstalling 0per8r

**Method 1: From the app (easiest)**
1. Open 0per8r and log in
2. Click the **Uninstall** button (top right, next to Logout)
3. Follow the prompts to remove the app

**Method 2: Windows Settings**
1. Open **Settings** → **Apps** → **Installed apps**
2. Search for "0per8r"
3. Click the three dots → **Uninstall**

**Method 3: Start Menu**
- The installer adds an "Uninstall 0per8r" shortcut in the Start Menu under the 0per8r folder

## Updates

0per8r checks for updates automatically. When a new version is available:
- The app will download it in the background
- You'll be prompted to restart to install
- Or it will install automatically when you quit the app

To manually check: the app will check on launch. For new versions, download the latest installer from [GitHub Releases](https://github.com/frana101/0per8r/releases).

