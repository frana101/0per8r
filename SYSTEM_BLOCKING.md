# System-Wide Website Blocking

## How It Works

The app now uses **system-wide blocking** via the macOS hosts file. This blocks distracting websites across **ALL browsers** (Chrome, Safari, Firefox, etc.), not just within the Electron app.

## What Gets Blocked

When you start a focus session, the app will:
1. **Backup** your original `/etc/hosts` file
2. **Block** a comprehensive list of distracting domains (social media, video sites, gaming, etc.)
3. **Allow** only:
   - `google.com` and all its subdomains (always allowed)
   - Any sites you explicitly add to "Allowed Websites"

## Admin Privileges Required

**Important**: System-wide blocking requires admin privileges. When you start a session, macOS will prompt you for your password. This is necessary to modify the hosts file.

### What Happens:
1. You click "Begin Execution"
2. macOS shows a password prompt
3. Enter your admin password
4. The hosts file is modified to block distracting sites
5. All browsers are now blocked from accessing those sites

## When Session Ends

When you end a session (complete or emergency exit), the app automatically:
- **Restores** your original hosts file
- Removes all blocking entries
- Everything returns to normal

## If the App Crashes

If the app crashes before restoring the hosts file:
- The app will automatically check and restore on next startup
- Your original hosts file is safely backed up
- You can manually restore by running: `sudo cp /etc/hosts.backup /etc/hosts` (if needed)

## What Sites Are Blocked?

The app blocks a comprehensive list including:
- Social media (Facebook, Twitter/X, Instagram, TikTok, Reddit, etc.)
- Video sites (YouTube, Netflix, Hulu, etc.)
- Gaming sites (Steam, Epic Games, etc.)
- Shopping sites (Amazon, eBay, etc.)
- News/media sites (CNN, BBC, etc.)
- And many more...

**Note**: Since the hosts file can't use wildcards, we block specific domains. This covers the vast majority of distracting sites. If you find a site that should be blocked but isn't, you can add it to the blocking list in the code.

## Troubleshooting

### "Failed to set up system-wide blocking"
- Make sure you entered your admin password correctly
- Check that you have admin privileges on your Mac
- Try restarting the app and starting a session again

### Sites still accessible
- Make sure you started a session (clicked "Begin Execution")
- Check that you entered your password when prompted
- Try flushing DNS cache: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`

### Can't access allowed sites
- Make sure you added the site to "Allowed Websites" in the dashboard
- The site domain must be added exactly (e.g., `github.com` not `www.github.com`)
- Try flushing DNS cache (see above)

## Security

- The app only modifies the hosts file during active sessions
- Your original hosts file is always backed up
- The hosts file is automatically restored when sessions end
- No data is sent anywhere - everything is local

