# How Updates Work - Important!

## ❌ Changes Don't Auto-Update Automatically

When I make changes to your code:
- ✅ Code is updated on your computer
- ❌ **NOT automatically published to GitHub**
- ❌ **Users don't get updates automatically**

## ✅ What You Need to Do

After I make changes, you need to:

### Step 1: Test the Changes
```bash
npm start
```
Make sure everything works!

### Step 2: Update Version Number
In `package.json`, change:
```json
"version": "1.0.1"  // Change from 1.0.0 to 1.0.1
```

### Step 3: Build and Publish
```bash
GH_TOKEN=your_token npm run publish:mac
```

### Step 4: Users Get Updates
- App checks GitHub (every 4 hours)
- Sees new version
- Shows update notification
- User installs update

## Summary

**My changes** → **You publish** → **Users get updates**

I don't publish automatically - you need to build and publish after changes!









