# Copy-Paste Steps to Fix Upload Issue

## Step 1: Install Homebrew (Copy and paste this whole block)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After it finishes, run this:

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

(If it says "command not found", try `/usr/local/bin/brew` instead of `/opt/homebrew/bin/brew`)

---

## Step 2: Install GitHub CLI

```bash
brew install gh
```

---

## Step 3: Login to GitHub

```bash
gh auth login
```

Follow the prompts:
- Choose "GitHub.com"
- Choose "HTTPS"
- Choose "Login with a web browser"
- Copy the code it shows
- Press Enter (opens browser)
- Paste the code in the browser
- Authorize it

---

## Step 4: Build Your App (without publishing)

```bash
cd "/Users/faiyaad/coding apps/focus app"
npm run build:mac
```

This creates the DMG files but doesn't try to upload (avoids the API issue).

---

## Step 5: Upload to GitHub (FAST - takes 1-2 minutes!)

```bash
gh release create v1.1.5 \
  --title "0per8r v1.1.5" \
  --notes "Version 1.1.5 - All features implemented" \
  dist/*.dmg \
  dist/*.blockmap
```

**Done!** This should take 1-2 minutes instead of 30! ✅

---

## If You Get Errors

**"brew: command not found" after installation:**
```bash
# For Apple Silicon Macs (M1/M2/M3):
eval "$(/opt/homebrew/bin/brew shellenv)"

# For Intel Macs:
eval "$(/usr/local/bin/brew shellenv)"
```

Then try `brew install gh` again.

**"gh: command not found" after installing:**
Close and reopen your terminal, then try again.






