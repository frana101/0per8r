# Fixing GitHub Release Upload Issues

## Issue 1: Can Only Upload One File?

**Solution:** You CAN upload multiple files! Here's how:

1. **Drag the first file** into the upload area
2. **Wait for it to finish uploading** (you'll see a progress bar)
3. **Drag the second file** into the SAME upload area
4. Both files will appear in the list

**OR:**
- Click "Attach files" button
- Select both files at once (hold Cmd/Ctrl and click both)
- They'll both upload

## Issue 2: Publish Button Grayed Out

The publish button needs:
1. **Tag name** - Type: `v1.0.0` (required!)
2. **Release title** - Type: `Version 1.0.0` (optional but recommended)
3. **At least one file uploaded**

Make sure you:
- Fill in the "Tag" field at the top
- Wait for file(s) to finish uploading
- Then the button should work

## Issue 3: Separate Releases?

**Not recommended** - but it would work. Better to have both files in ONE release:
- Users see one release with both options
- Auto-updater works better
- Cleaner GitHub page

## Step-by-Step: Upload Both Files

1. Go to: **https://github.com/frana101/0per8r/releases**
2. Click **"Create a new release"**
3. **Tag:** `v1.0.0`
4. **Title:** `Version 1.0.0`
5. **Description:** (optional) "First release of 0per8r"
6. **Drag first DMG file** → Wait for upload
7. **Drag second DMG file** → Wait for upload
8. Both should appear in the file list
9. Click **"Publish release"**

## If It Still Doesn't Work

Try this:
1. Create release with just the tag and title (no files)
2. Click "Publish release"
3. Go back and edit the release
4. Now upload files - should work!

