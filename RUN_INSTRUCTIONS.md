# How to Run 0per8r

## Step-by-Step Instructions

### 1. Open Terminal
- Press `Cmd + Space` to open Spotlight
- Type "Terminal" and press Enter
- Or find Terminal in Applications > Utilities

### 2. Navigate to the Project Folder
```bash
cd "/Users/faiyaad/coding apps/focus app"
```

### 3. Install Dependencies (First Time Only)
```bash
npm install
```
*Note: This has already been done, so you can skip this step if you've already run it.*

### 4. Run the Application
```bash
npm start
```

The 0per8r window should open!

## Quick Start

Once the app opens:

1. **Select Your Work Application** - Choose from the dropdown (e.g., "Visual Studio Code", "Safari", "Chrome")
2. **Enter Your Task** - Be specific! (e.g., "Write 500 words of chapter 2")
3. **Set Duration** - Choose 15-120 minutes
4. **Click "COMMIT TASK"**
5. **Type "EXECUTE"** to begin
6. **Work in your selected app** - The app will monitor you!

## What Happens During Execution

- ✅ You can work in your selected application
- ❌ Switching to other apps = Break attempt logged
- ⚠️ 0per8r will pop up when you switch apps
- 📊 Your focus score decreases with each break
- 🔒 Window restrictions activate (can't close/minimize)

## Stopping the App

- Press `Ctrl + C` in the terminal to quit
- Or use "EMERGENCY EXIT" button (marks session as failed)

## Troubleshooting

**If the app doesn't start:**
- Make sure you're in the correct directory
- Try running `npm install` again
- Check that Node.js is installed: `node --version`

**If app detection doesn't work:**
- Make sure you're on macOS (Windows/Linux support coming soon)
- Grant accessibility permissions if prompted
- The app name must match exactly (case-insensitive)

## Building a Standalone App (Optional)

To create a distributable `.app` file:
```bash
npm run build
```

This creates a standalone application you can share or move anywhere.





