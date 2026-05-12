# Debugging EchoKit Blank Screen Issue

## 🐛 Problem
Extension shows a blank/black screen in both the popup and DevTools tab.

## 🔍 Manual Debugging Steps

### Step 1: Check Chrome DevTools Console

1. **For Popup**:
   - Right-click the extension icon → "Inspect popup"
   - Check the Console tab for any red errors
   - Look for import/module errors

2. **For DevTools Panel**:
   - Open Chrome DevTools (F12)
   - Click the "EchoKit" tab
   - Press Cmd+Option+I (Mac) or Ctrl+Shift+I (Windows) to inspect the DevTools panel itself
   - Check Console for errors

3. **For Background Service Worker**:
   - Go to `chrome://extensions`
   - Find "EchoKit"
   - Click "Inspect views: service worker"
   - Check Console for errors

### Step 2: Common Issues to Check

#### Issue 1: Module Import Errors
**Symptom**: Console shows "Failed to load module" or "import not found"

**Check**:
```
extension/
  shared/
    app.js ← exports initEchoKitUI
    json-highlight.js ← exports highlightJSON
    matcher.js
    store.js
```

**Fix**: Ensure all imported modules exist and export the right functions

#### Issue 2: Theme/CSS Not Loading
**Symptom**: Elements exist in DOM but are invisible (CSS not applied)

**Check in Console**:
```javascript
// In popup inspector:
document.getElementById('ek-root').innerHTML.length
// Should be > 1000 chars if rendered

document.querySelector('[data-testid="echokit-app"]')
// Should return an element if rendering worked
```

**Fix**: Check if `extension/shared/styles.css` exists and is being loaded

#### Issue 3: Runtime Initialization Error
**Symptom**: Console shows error in `initEchoKitUI` or `refresh`

**Possible causes**:
- Chrome storage API permission issue
- Background service worker not responding
- Async/await error in initialization

### Step 3: Quick Console Tests

Open the popup inspector and run these commands:

```javascript
// Test 1: Check if root exists
document.getElementById('ek-root')
// Should return: <div id="ek-root"...>

// Test 2: Check if app module loaded
chrome.runtime.getManifest().version
// Should return: "1.6.4"

// Test 3: Try manual init (if app.js loaded)
// This will fail if there's an import error
```

## 🔧 Likely Causes (Ranked by Probability)

### 1. **Module Import Path Issue** (Most Likely)
Recent changes may have broken relative import paths.

**Check**: 
- `popup/popup.js` imports `../shared/app.js` ✓
- `app.js` imports `./json-highlight.js` ✓

**Test**:
```bash
# From project root:
ls extension/shared/json-highlight.js
# Should exist
```

### 2. **JSON Highlight Module Missing**
`app.js` line 4 imports `json-highlight.js`

**Check**:
```bash
ls extension/shared/json-highlight.js
```

**If missing**: The file might have been deleted or never committed

### 3. **Background Service Worker Crash**
If the service worker crashes on startup, the popup won't work.

**Check**:
- `chrome://extensions` → EchoKit → "Inspect views: service worker"
- Look for red "Errors" badge

### 4. **Storage API Permission Issue**
The app tries to read from `chrome.storage` on init.

**Check**: Manifest has `"storage"` permission (it does ✓)

### 5. **Theme CSS Missing Color Variables**
Elements render but are invisible due to black-on-black text.

**Check**: Look in Elements inspector for `<div class="ek-app popup">` - if it exists, CSS is the issue.

## ✅ Quick Fix Checklist

Run these commands to verify file structure:

```bash
# 1. Check all required files exist
ls extension/popup/popup.html
ls extension/popup/popup.js
ls extension/shared/app.js
ls extension/shared/json-highlight.js
ls extension/shared/matcher.js
ls extension/shared/store.js
ls extension/shared/styles.css
ls extension/background.js

# 2. Check for syntax errors
node -c extension/popup/popup.js
node -c extension/shared/app.js
node -c extension/shared/json-highlight.js
node -c extension/background.js

# 3. Reload extension
# Go to chrome://extensions → Click the reload icon on EchoKit
```

## 🚨 Emergency Rollback

If the issue started after the recent commits, roll back:

```bash
git log --oneline -5
# Identify the last working commit

git checkout <last-working-commit> extension/
# Test if it works

git commit -m "fix: Rollback to working extension state"
```

## 📸 Screenshot for Debugging

Take these screenshots and share:
1. Popup inspector Console tab (any errors?)
2. Elements inspector showing `#ek-root` innerHTML
3. `chrome://extensions` showing EchoKit status
4. Background service worker console

## 🔄 Next Steps

After identifying the issue, create a test to prevent regression (see AUTOMATED_TESTING.md).
