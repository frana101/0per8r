# Code Signing - How to Avoid "Damaged" Error

## Why Framer Doesn't Have This Problem

**Framer is code-signed!** They have an Apple Developer account ($99/year) and sign their app, so macOS trusts it automatically.

## Your Options

### Option 1: Code Sign (Best for Users)

**Cost:** $99/year for Apple Developer account

**What you get:**
- ✅ No "damaged" error
- ✅ Users can download and open directly
- ✅ More professional/trusted
- ✅ Can distribute outside App Store

**How to do it:**

1. **Get Apple Developer account:**
   - Go to: https://developer.apple.com/programs/
   - Sign up ($99/year)
   - Wait for approval (usually instant)

2. **Get certificates:**
   - Go to: https://developer.apple.com/account/resources/certificates/list
   - Create "Developer ID Application" certificate
   - Download and install it

3. **Update package.json:**
   I'll add the signing config once you have the certificate.

4. **Build:**
   ```bash
   GH_TOKEN=token npm run publish:mac
   ```
   It will automatically sign!

**Result:** Users download → app opens directly, no errors! ✅

### Option 2: Keep Current Setup (Free)

**Cost:** Free

**What happens:**
- ❌ Users get "damaged" error
- ✅ They run `xattr -cr /Applications/0per8r.app`
- ✅ App works fine after that

**For users:** Include instructions in README:
```bash
# After downloading, run:
xattr -cr /Applications/0per8r.app
```

## Comparison

| Feature | Code Signed | Not Signed |
|---------|-------------|------------|
| Cost | $99/year | Free |
| User experience | Open directly | Run xattr command |
| Professional | ✅ Yes | ⚠️ Less |
| Trust | ✅ High | ⚠️ Lower |

## Recommendation

**For now:** Keep free, include xattr instructions

**Later:** If app gets popular, get Developer account and code sign

## How Framer Does It

Framer:
1. Has Apple Developer account
2. Code signs their app
3. Notarizes it with Apple
4. Users download → opens directly ✅

You can do the same with $99/year!

## Summary

- **Code signing = $99/year** → No "damaged" error
- **No code signing = Free** → Users run `xattr` command
- **Framer is code-signed** → That's why no issues
- **You can still distribute** → Don't need App Store for code signing

Let me know if you want to set up code signing!









