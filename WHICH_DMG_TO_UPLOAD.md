# Which DMG to Upload?

## Answer: Upload BOTH! ✅

You have two DMG files:
1. **`0per8r-1.0.0.dmg`** - For Intel Macs (older Macs)
2. **`0per8r-1.0.0-arm64.dmg`** - For Apple Silicon Macs (M1/M2/M3/M4)

## Why Both?

- **Intel Macs** need the regular `.dmg`
- **Apple Silicon Macs** need the `-arm64.dmg`
- The auto-updater automatically picks the right one for each user

## How to Upload Both

### Option 1: Automatic (Recommended)
When you build with the GitHub token, it should upload both automatically:
```bash
GH_TOKEN=your_token npm run build:mac
```

### Option 2: Manual Upload
1. Go to: **https://github.com/frana101/0per8r/releases**
2. Click **"Create a new release"** (or edit existing)
3. Drag **BOTH** DMG files:
   - `0per8r-1.0.0.dmg`
   - `0per8r-1.0.0-arm64.dmg`
4. Click **"Publish release"**

## If You Can Only Upload One

If you absolutely must choose one:
- **Upload the `-arm64.dmg`** (Apple Silicon version)
- Reason: Most new Macs are Apple Silicon
- Intel Macs are becoming rare

But really, upload both for best compatibility!

## File Sizes
- Regular DMG: ~103 MB
- ARM64 DMG: ~99 MB
- Both together: ~202 MB (totally fine for GitHub)

