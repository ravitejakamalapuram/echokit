# Chrome Web Store - Automated Publishing Setup

This guide walks you through setting up **fully automated** Chrome Web Store publishing via GitHub Actions.

---

## 🎯 Overview

Once configured, your workflow will:
1. ✅ Automatically trigger on every git tag push (`v1.2.3`)
2. ✅ Build and package the extension
3. ✅ Upload to Chrome Web Store
4. ✅ Publish immediately (goes into review queue)
5. ✅ Create GitHub Release with artifacts

**No manual steps required after initial setup!**

---

## ⚡ Quick Start (30 minutes)

### Step 1: Create Google Cloud Project (5 min)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "EchoKit Publishing")
3. Note your **Project ID**

### Step 2: Enable Chrome Web Store API (2 min)

1. Go to [APIs & Services → Library](https://console.cloud.google.com/apis/library)
2. Search for "Chrome Web Store API"
3. Click **Enable**

### Step 3: Create OAuth Credentials (5 min)

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External**
   - App name: `EchoKit Publisher`
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue** (skip scopes, test users)
4. Back to Create OAuth client ID:
   - Application type: **Web application**
   - Name: `Chrome Web Store Publisher`
   - **Authorized redirect URIs**: Add `https://developers.google.com/oauthplayground`
   - Click **Create**
5. **Save these values** (you'll need them):
   - ✅ **Client ID** (looks like: `123456789-abc.apps.googleusercontent.com`)
   - ✅ **Client Secret** (looks like: `GOCSPX-abc123...`)

### Step 4: Get Your Extension ID (2 min)

**If your extension is already published:**
- Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- Click on your extension
- Copy the **Item ID** from the URL or details page

**If not yet published:**
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay the $5 one-time developer fee (if you haven't)
3. Click **New Item**
4. Upload `store/echokit-api-recorder-mocker-v1.6.0.zip`
5. Fill in required listing details
6. **Save as draft** (don't publish yet)
7. Copy the **Extension ID**

### Step 5: Generate Refresh Token (10 min)

This is the most important step. The refresh token allows GitHub Actions to publish on your behalf.

1. Go to [Google OAuth Playground](https://developers.google.com/oauthplayground)

2. Click the **⚙️ settings icon** (top right)

3. Check **"Use your own OAuth credentials"**

4. Enter:
   - **OAuth Client ID**: Paste your Client ID from Step 3
   - **OAuth Client Secret**: Paste your Client Secret from Step 3

5. In the left panel, scroll to **"Step 1 - Select & authorize APIs"**

6. In the input box labeled **"Input your own scopes"**, enter:
   ```
   https://www.googleapis.com/auth/chromewebstore
   ```

7. Click **"Authorize APIs"**

8. Sign in with the **same Google account** that owns your Chrome Web Store developer account

9. Click **"Allow"** to grant permissions

10. You'll be redirected back to OAuth Playground

11. Click **"Exchange authorization code for tokens"** button

12. **Copy the Refresh Token** from the response (it starts with `1//`)
    - ✅ **Refresh Token** (looks like: `1//0gAB1CdEf...`)

⚠️ **Important**: This refresh token **never expires** unless you revoke it. Keep it secret!

### Step 6: Add Secrets to GitHub (5 min)

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add each of these:

   | Secret Name | Value | Example |
   |-------------|-------|---------|
   | `CWS_EXTENSION_ID` | Your extension ID | `abcdefghijklmnop` |
   | `CWS_CLIENT_ID` | OAuth Client ID | `123-abc.apps.googleusercontent.com` |
   | `CWS_CLIENT_SECRET` | OAuth Client Secret | `GOCSPX-abc123xyz...` |
   | `CWS_REFRESH_TOKEN` | OAuth Refresh Token | `1//0gABcDeF...` |

4. Click **"Add secret"** for each one

---

## 🚀 Test Your Setup

### Deploy a Test Release

```bash
# Make sure you're on main branch with latest changes
git checkout main
git pull

# Create and push a test tag
git tag v1.6.1
git push origin v1.6.1
```

### Monitor the Workflow

1. Go to your GitHub repository
2. Click the **Actions** tab
3. You should see a new "Release" workflow running
4. Click on it to see real-time logs

**Expected output:**
```
✅ All Chrome Web Store secrets present
📤 Uploading extension to Chrome Web Store...
✅ Upload successful
🚀 Publishing extension...
✅ Extension published successfully!
🎉 EchoKit v1.6.1 is now live on Chrome Web Store
```

### Verify in Chrome Web Store

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. You should see your extension with the new version uploaded
3. Status will show "Pending Review" (typically 1-2 days)

---

## 🔄 Regular Release Workflow

After setup, releasing is simple:

```bash
# 1. Commit your changes
git add .
git commit -m "feat: new awesome feature"

# 2. Create and push a version tag
git tag v1.7.0
git push origin v1.7.0

# 3. That's it! GitHub Actions handles everything else
```

The workflow will automatically:
- Build the extension
- Create a GitHub Release
- Upload to Chrome Web Store
- Publish for review

---

## 🛠️ Troubleshooting

### "Missing required GitHub Secrets"

**Cause**: One or more secrets are not configured

**Fix**: Double-check all 4 secrets are added in GitHub Settings → Secrets → Actions

### "Upload failed with HTTP 401"

**Cause**: Invalid or expired credentials

**Fix**: 
1. Regenerate the refresh token (Step 5)
2. Update `CWS_REFRESH_TOKEN` secret in GitHub

### "Upload failed with HTTP 404"

**Cause**: Extension ID is incorrect

**Fix**: Verify `CWS_EXTENSION_ID` matches your extension in the Chrome Web Store dashboard

### "Publish failed" but upload succeeded

**Cause**: Extension might already be in review

**Fix**: Check the Chrome Web Store dashboard - it may have published successfully despite the error

---

## 📚 Additional Resources

- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/using-api)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

---

## 🔐 Security Notes

- ✅ Refresh tokens are stored as **encrypted GitHub Secrets**
- ✅ They're only accessible to GitHub Actions runners
- ✅ Never commit secrets to your repository
- ✅ Refresh tokens don't expire (unless revoked)
- ⚠️ If compromised, revoke in Google Cloud Console and regenerate
