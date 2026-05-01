# EchoKit - Automated Release Process

## 🚀 One-Command Release

Release a new version of EchoKit with a single command:

```bash
git tag v1.7.0 && git push origin v1.7.0
```

That's it! The rest is fully automated.

---

## 🤖 What Happens Automatically

When you push a version tag (`v*.*.*`), GitHub Actions will:

1. ✅ **Validate** - Check all Chrome Web Store credentials are configured
2. ✅ **Sync** - Update `extension/manifest.json` with the tag version
3. ✅ **Build** - Create production zip file
4. ✅ **GitHub Release** - Create release with auto-generated notes + artifacts
5. ✅ **Upload** - Upload new version to Chrome Web Store
6. ✅ **Publish** - Submit for Chrome review (goes live after 1-2 days)

**Zero manual intervention required!**

---

## 📋 Pre-Release Checklist

Before pushing a tag, ensure:

- [ ] All tests pass (`npm test` or your test command)
- [ ] Code is committed and pushed to `main`
- [ ] Version number follows semver (major.minor.patch)
- [ ] CHANGELOG or release notes are updated (optional)

---

## 🏷️ Version Tag Examples

```bash
# Patch release (bug fixes)
git tag v1.6.1 && git push origin v1.6.1

# Minor release (new features, backward compatible)
git tag v1.7.0 && git push origin v1.7.0

# Major release (breaking changes)
git tag v2.0.0 && git push origin v2.0.0
```

---

## 🔍 Monitor Release Progress

### View Workflow Logs

1. Go to: https://github.com/ravitejakamalapuram/echokit/actions
2. Click on the latest "Release" workflow
3. Watch real-time progress

### Successful Release Output

```
✅ All Chrome Web Store secrets present
📤 Uploading extension to Chrome Web Store...
✅ Upload successful
🚀 Publishing extension...
✅ Extension published successfully!
🎉 EchoKit v1.7.0 is now live on Chrome Web Store
📋 Note: Chrome review typically takes 1-2 days before going fully live
```

### Check Chrome Web Store

1. Go to: https://chrome.google.com/webstore/devconsole
2. Your extension should show the new version
3. Status: "Pending Review" → "Published" (after 1-2 days)

---

## ⚠️ First-Time Setup Required

If you haven't set up automated publishing yet, you'll see this error:

```
❌ ERROR: Missing required GitHub Secrets: CWS_EXTENSION_ID CWS_CLIENT_ID ...
```

**Solution**: Follow the setup guide at `.github/CHROME_WEB_STORE_SETUP.md`

---

## 🔧 Rollback a Release

If you need to rollback:

### Option 1: Quick Patch Release

```bash
# Revert problematic changes
git revert <commit-hash>
git commit -m "fix: revert problematic feature"

# Release new patch version
git tag v1.7.1
git push origin v1.7.1
```

### Option 2: Manual Chrome Web Store Rollback

1. Go to Chrome Web Store Developer Dashboard
2. Navigate to your extension
3. Upload a previous version ZIP from GitHub Releases
4. Publish manually

---

## 🎯 Best Practices

### Semantic Versioning

- **Patch** (1.6.x): Bug fixes, no new features
- **Minor** (1.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes

### Testing Before Release

```bash
# Run tests locally
npm test  # or your test command

# Build locally to verify
bash scripts/build-store-zip.sh

# Test extension locally (load unpacked in Chrome)
```

### Release Cadence

- **Patch releases**: As needed for critical bugs
- **Minor releases**: Every 2-4 weeks for features
- **Major releases**: When introducing breaking changes

---

## 📊 Release Timeline

```
You push tag
    ↓
    1 minute - GitHub Actions builds & publishes
    ↓
    2 minutes - Extension uploaded to Chrome Web Store
    ↓
    1-2 days - Chrome review process
    ↓
    ✅ Extension live on Chrome Web Store
```

---

## 🐛 Troubleshooting

### Workflow fails: "Missing required secrets"

**Fix**: Complete setup in `.github/CHROME_WEB_STORE_SETUP.md`

### Workflow fails: "Upload failed HTTP 401"

**Fix**: Refresh token may be expired. Regenerate and update `CWS_REFRESH_TOKEN` secret.

### Tag already exists

```bash
# Delete local tag
git tag -d v1.7.0

# Delete remote tag
git push origin :refs/tags/v1.7.0

# Create new tag
git tag v1.7.0
git push origin v1.7.0
```

### Want to test without publishing

Currently, the workflow always publishes. To test the build only:

```bash
# Build locally
bash scripts/build-store-zip.sh

# Check the output
ls -lh store/echokit-*.zip
```

---

## 📞 Support

- **Workflow issues**: Check [GitHub Actions logs](https://github.com/ravitejakamalapuram/echokit/actions)
- **Chrome Web Store issues**: [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- **API errors**: [Chrome Web Store API Docs](https://developer.chrome.com/docs/webstore/using-api)

---

## 🎉 That's It!

Your Chrome extension now has **fully automated CI/CD**. Just push a tag and watch the magic happen! ✨
