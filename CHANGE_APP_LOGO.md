# How to Change App Logo/Icon

## Step 1: Create Icon Files

You need icon files in these formats:

### For Mac:
- `icon.icns` (512x512 or 1024x1024 recommended)

### For Windows:
- `icon.ico` (256x256 or 512x512 recommended)

### For Both (Optional):
- `icon.png` (1024x1024 recommended)

## Step 2: Create Icons

### Option A: Use Online Tool (Easiest)
1. Go to: **https://www.icoconverter.com/** or **https://cloudconvert.com/png-to-icns**
2. Upload your logo/icon image (PNG, JPG, etc.)
3. Convert to:
   - `.icns` for Mac
   - `.ico` for Windows
4. Download the files

### Option B: Use Image Editor
- Create 1024x1024 PNG image
- Use tools like:
  - **Image2icon** (Mac app)
  - **IconWorkshop** (Windows)
  - Online converters

## Step 3: Add Icons to Project

1. Create `build` folder in your project:
   ```bash
   mkdir build
   ```

2. Put icon files in `build/` folder:
   - `build/icon.icns` (for Mac)
   - `build/icon.ico` (for Windows)
   - `build/icon.png` (optional, for both)

## Step 4: Update package.json

I'll update your `package.json` to use the icons.

## Step 5: Rebuild

After adding icons:
```bash
GH_TOKEN=your_token npm run publish:mac
```

The new icon will appear in:
- App icon (Dock, Applications folder)
- DMG file
- App window (if configured)

## Quick Setup

1. **Get/create your logo** (PNG image, square, 1024x1024)
2. **Convert to icons:**
   - Mac: Convert to `.icns`
   - Windows: Convert to `.ico`
3. **Put in `build/` folder**
4. **I'll update package.json**
5. **Rebuild app**

## Where to Get Icons

- **Design your own:** Use Figma, Canva, Photoshop
- **Use existing:** Find PNG logo, convert to icons
- **Hire designer:** Get custom icon designed

Let me know when you have the icon files, and I'll update the config!









