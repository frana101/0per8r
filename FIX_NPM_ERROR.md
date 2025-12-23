# Fix: npm Error - Can't Find package.json

## The Problem

You're running the command from the wrong directory (your home folder).

## The Fix

**Always navigate to the project folder first:**

```bash
cd "/Users/faiyaad/coding apps/focus app"
```

**Then run your command:**
```bash
GH_TOKEN=your_token npm run build:mac
```

## Quick Copy-Paste Commands

**To build:**
```bash
cd "/Users/faiyaad/coding apps/focus app" && GH_TOKEN=your_token npm run build:mac
```

**To run app:**
```bash
cd "/Users/faiyaad/coding apps/focus app" && npm start
```

## How to Know You're in the Right Place

Run this to check:
```bash
pwd
```

Should show: `/Users/faiyaad/coding apps/focus app`

If it shows `/Users/faiyaad` → you're in the wrong place!

## Pro Tip

Add this to your Terminal profile (optional):
```bash
alias 0per8r='cd "/Users/faiyaad/coding apps/focus app"'
```

Then you can just type `0per8r` to go there!

