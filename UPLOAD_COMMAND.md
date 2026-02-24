# Upload Command for v1.1.6 (macOS + Windows)

## Quick Command (Copy-Paste This):

```bash
cd "/Users/faiyaad/coding apps/focus app" && /opt/homebrew/bin/gh release create v1.1.6 --title "0per8r v1.1.6" --notes "Version 1.1.6 - All features implemented" dist/0per8r-1.1.6.dmg dist/0per8r-1.1.6-arm64.dmg dist/0per8r-1.1.6.dmg.blockmap dist/0per8r-1.1.6-arm64.dmg.blockmap "dist/0per8r Setup 1.1.6.exe" "dist/0per8r Setup 1.1.6.exe.blockmap" || /opt/homebrew/bin/gh release upload v1.1.6 dist/0per8r-1.1.6.dmg dist/0per8r-1.1.6-arm64.dmg dist/0per8r-1.1.6.dmg.blockmap dist/0per8r-1.1.6-arm64.dmg.blockmap "dist/0per8r Setup 1.1.6.exe" "dist/0per8r Setup 1.1.6.exe.blockmap" --clobber
```

## Or Use the Script:

```bash
cd "/Users/faiyaad/coding apps/focus app"
chmod +x UPLOAD_ALL.sh
./UPLOAD_ALL.sh
```

## Files Being Uploaded:

**macOS:**
- `0per8r-1.1.6.dmg` (Intel Mac)
- `0per8r-1.1.6-arm64.dmg` (Apple Silicon Mac)
- Blockmap files for both

**Windows:**
- `0per8r Setup 1.1.6.exe` (Windows installer)
- Blockmap file





