# Build Icons Folder

## Add Your Icons Here

Put your icon files in this folder:

- `icon.icns` - For Mac (required)
- `icon.ico` - For Windows (required)
- `icon.png` - Base icon (optional, 1024x1024 recommended)

## How to Create Icons

1. **Create/design your logo** (PNG, square, 1024x1024)
2. **Convert to icons:**
   - Mac: Use https://cloudconvert.com/png-to-icns
   - Windows: Use https://cloudconvert.com/png-to-ico
3. **Put files here:**
   - `build/icon.icns`
   - `build/icon.ico`
   - `build/icon.png` (optional)

## After Adding Icons

Rebuild the app:
```bash
GH_TOKEN=your_token npm run publish:mac
```

The new icon will appear in the app!









