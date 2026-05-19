# Chrome Web Store Auto-Publishing Setup Checklist

Complete this checklist to enable fully automated Chrome extension publishing.

**Time required**: ~30 minutes (one-time setup)

---

## ✅ Setup Checklist

### 1. Google Cloud Console Setup

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Create new project: `EchoKit Publishing` (or similar)
- [ ] Enable [Chrome Web Store API](https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com)
- [ ] Create OAuth 2.0 credentials:
  - [ ] Go to [Credentials](https://console.cloud.google.com/apis/credentials)
  - [ ] Click **Create Credentials** → **OAuth client ID**
  - [ ] Configure OAuth consent screen (if prompted)
  - [ ] Application type: **Web application**
  - [ ] Add redirect URI: `https://developers.google.com/oauthplayground`
  - [ ] **Save Client ID and Client Secret** ✍️

### 2. Chrome Web Store Setup

- [ ] Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [ ] Pay $5 one-time developer fee (if not already paid)
- [ ] Upload extension (or use existing one)
- [ ] **Save Extension ID** ✍️ (from URL or dashboard)

### 3. Generate Refresh Token

- [ ] Go to [OAuth Playground](https://developers.google.com/oauthplayground)
- [ ] Click ⚙️ settings → Check "Use your own OAuth credentials"
- [ ] Enter Client ID and Client Secret from Step 1
- [ ] In "Input your own scopes", enter: `https://www.googleapis.com/auth/chromewebstore`
- [ ] Click **Authorize APIs**
- [ ] Sign in with Google account that owns the extension
- [ ] Click **Allow**
- [ ] Click **Exchange authorization code for tokens**
- [ ] **Save Refresh Token** ✍️ (starts with `1//`)

### 4. Add GitHub Secrets

Go to: `https://github.com/ravitejakamalapuram/echokit/settings/secrets/actions`

- [ ] Add secret `CWS_EXTENSION_ID` = [Your extension ID]
- [ ] Add secret `CWS_CLIENT_ID` = [Your OAuth client ID]
- [ ] Add secret `CWS_CLIENT_SECRET` = [Your OAuth client secret]
- [ ] Add secret `CWS_REFRESH_TOKEN` = [Your refresh token]

### 5. Test the Setup

- [ ] Ensure all code is committed and pushed
- [ ] Run: `git tag v1.6.1 && git push origin v1.6.1`
- [ ] Go to [GitHub Actions](https://github.com/ravitejakamalapuram/echokit/actions)
- [ ] Verify workflow completes successfully
- [ ] Check [Chrome Web Store Dashboard](https://chrome.google.com/webstore/devconsole)
- [ ] Confirm new version is uploaded and in review

---

## 📋 Values You Need

**Keep these secure!** Never commit them to your repository.

| Secret Name | Value | Where to Find |
|-------------|-------|---------------|
| `CWS_EXTENSION_ID` | `________________` | Chrome Web Store dashboard |
| `CWS_CLIENT_ID` | `________________` | Google Cloud Console → Credentials |
| `CWS_CLIENT_SECRET` | `________________` | Google Cloud Console → Credentials |
| `CWS_REFRESH_TOKEN` | `________________` | OAuth Playground (after authorization) |

---

## ✨ After Setup

Once complete, releasing is as simple as:

```bash
git tag v1.7.0 && git push origin v1.7.0
```

Everything else happens automatically! 🎉

---

## 🆘 Need Help?

- **Detailed setup guide**: [CHROME_WEB_STORE_SETUP.md](CHROME_WEB_STORE_SETUP.md)
- **Release process**: [AUTOMATED_RELEASE.md](AUTOMATED_RELEASE.md)
- **Chrome Web Store API**: https://developer.chrome.com/docs/webstore/using-api
- **OAuth Playground**: https://developers.google.com/oauthplayground

---

## 🔐 Security Notes

- ✅ All secrets are encrypted by GitHub
- ✅ Only accessible to GitHub Actions
- ✅ Refresh tokens don't expire
- ⚠️ If compromised, revoke and regenerate in Google Cloud Console
