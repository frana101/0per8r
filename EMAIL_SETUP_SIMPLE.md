# Email Setup - Simple Steps

## What I Just Did
- Installed Resend (email service)
- Updated code to send real emails
- You just need to add your API key

## Step-by-Step

### Step 1: Get Resend API Key
1. Go to: **https://resend.com**
2. Sign up (it's free)
3. After signing up, go to **"API Keys"**
4. Click **"Create API Key"**
5. Name it: `0per8r`
6. **COPY THE KEY** (starts with `re_...`)

### Step 2: Add API Key to App
1. Open the app: `npm start`
2. When you sign up, you'll see the code in terminal (for now)
3. To enable real emails, you need to add the API key

**Option A: Add via Browser Console (Quick Test)**
1. Open app
2. Press `F12` or `Cmd+Option+I` to open Developer Tools
3. Go to "Console" tab
4. Type this (replace with your key):
   ```javascript
   localStorage.setItem('0per8r_resend_api_key', 're_YOUR_KEY_HERE');
   ```
5. Press Enter
6. Now try signing up - it will send real emails!

**Option B: Add to Code (Permanent)**
I can add a settings page where you enter the API key. Let me know if you want that.

## Test It
1. Add your API key (Option A above)
2. Try signing up with your email
3. Check your inbox for the verification code!

## Important Notes
- **Free tier:** Resend gives you 100 emails/day free
- **From address:** Currently uses `onboarding@resend.dev`
- **For production:** You'll want to verify your own domain

## If Emails Don't Send
- Check console for errors
- Make sure API key is correct
- Resend might need domain verification for some emails
- Check Resend dashboard for delivery status

