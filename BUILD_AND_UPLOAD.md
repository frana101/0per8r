# Build and Upload Commands for 0per8r

## Quick Command (Build + Upload Both Platforms)

```bash
cd "/Users/faiyaad/coding apps/focus app" && npm run build:all && /opt/homebrew/bin/gh release create v1.2.7 --title "0per8r v1.2.7" --notes "Version 1.2.7 - Windows Support:
- Added Windows system-wide blocking (proxy + hosts file)
- Single password prompt on quit (Windows)
- Fixed website unblocking on quit
- Windows SmartScreen bypass instructions included" dist/0per8r-1.2.7.dmg dist/0per8r-1.2.7-arm64.dmg "dist/0per8r Setup 1.2.7.exe" dist/0per8r-1.2.7.dmg.blockmap dist/0per8r-1.2.7-arm64.dmg.blockmap "dist/0per8r Setup 1.2.7.exe.blockmap" || /opt/homebrew/bin/gh release upload v1.2.7 dist/0per8r-1.2.7.dmg dist/0per8r-1.2.7-arm64.dmg "dist/0per8r Setup 1.2.7.exe" dist/0per8r-1.2.7.dmg.blockmap dist/0per8r-1.2.7-arm64.dmg.blockmap "dist/0per8r Setup 1.2.7.exe.blockmap" --clobber
```

## Step-by-Step Commands

### 1. Build Both Platforms
```bash
cd "/Users/faiyaad/coding apps/focus app"
npm run build:all
```

### 2. Upload to GitHub (if release doesn't exist)
```bash
/opt/homebrew/bin/gh release create v1.2.7 \
  --title "0per8r v1.2.7" \
  --notes "Version 1.2.7 - Windows Support:
- Added Windows system-wide blocking (proxy + hosts file)
- Single password prompt on quit (Windows)
- Fixed website unblocking on quit
- Windows SmartScreen bypass instructions included" \
  dist/0per8r-1.2.7.dmg \
  dist/0per8r-1.2.7-arm64.dmg \
  "dist/0per8r Setup 1.2.7.exe" \
  dist/0per8r-1.2.7.dmg.blockmap \
  dist/0per8r-1.2.7-arm64.dmg.blockmap \
  "dist/0per8r Setup 1.2.7.exe.blockmap"
```

### 3. Upload to Existing Release (if release already exists)
```bash
/opt/homebrew/bin/gh release upload v1.2.7 \
  dist/0per8r-1.2.7.dmg \
  dist/0per8r-1.2.7-arm64.dmg \
  "dist/0per8r Setup 1.2.7.exe" \
  dist/0per8r-1.2.7.dmg.blockmap \
  dist/0per8r-1.2.7-arm64.dmg.blockmap \
  "dist/0per8r Setup 1.2.7.exe.blockmap" \
  --clobber
```

## Individual Platform Builds

### Build macOS Only
```bash
npm run build:mac
```

### Build Windows Only
```bash
npm run build:win
```

## Files Being Uploaded

- `0per8r-1.2.7.dmg` - macOS Intel (x64)
- `0per8r-1.2.7-arm64.dmg` - macOS Apple Silicon (M1/M2/M3)
- `0per8r Setup 1.2.7.exe` - Windows (x64 + ia32)
- `*.blockmap` files - For efficient updates

## Notes

- The `||` in the quick command means: try to create release, if it fails (because it exists), upload to existing release instead
- `--clobber` flag overwrites existing files if they're already uploaded
- All files are already built, so you can skip the build step if you just want to upload

