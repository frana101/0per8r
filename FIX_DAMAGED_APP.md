# Fix "App is Damaged" Error on macOS

## Why This Happens

macOS Gatekeeper blocks apps that aren't code signed by an Apple Developer. This is a security feature, but it affects unsigned apps.

## Solution 1: Remove Quarantine Attribute (Recommended)

Have the user run this command in Terminal:

```bash
xattr -cr /Applications/0per8r.app
```

Or if they haven't moved it to Applications yet:

```bash
xattr -cr /Volumes/0per8r\ 1.0.0/0per8r.app
```

Then try opening it again.

## Solution 2: Right-Click Open

1. Right-click (or Control+Click) on the app
2. Select "Open" from the menu
3. Click "Open" in the warning dialog
4. The app will be added to the exception list

## Solution 3: System Preferences

1. Go to System Preferences → Security & Privacy
2. Click "Open Anyway" if you see a message about the app
3. Or go to General tab and allow the app

## Solution 4: Disable Gatekeeper (Not Recommended)

Only for testing/development:

```bash
sudo spctl --master-disable
```

**Warning:** This disables macOS security features. Re-enable with:
```bash
sudo spctl --master-enable
```

## For Distribution

To avoid this issue for end users, you would need to:
1. Get an Apple Developer account ($99/year)
2. Code sign the app
3. Notarize it with Apple

For now, Solution 1 or 2 will work for users.

