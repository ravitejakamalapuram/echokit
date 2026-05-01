# EchoKit CI/CD Pipeline

## 🚀 Fully Automated Release Pipeline

**TL;DR**: Push a version tag, everything else is automatic.

```bash
git tag v1.7.0 && git push origin v1.7.0
```

The pipeline will:
1. ✅ Validate Chrome Web Store credentials
2. ✅ Build and package the extension
3. ✅ Create GitHub Release with artifacts
4. ✅ Upload to Chrome Web Store
5. ✅ Publish for Chrome review (live in 1-2 days)

**📖 Detailed guides:**
- **[Automated Release Process](AUTOMATED_RELEASE.md)** - Quick reference for releases
- **[Chrome Web Store Setup](CHROME_WEB_STORE_SETUP.md)** - One-time credential setup (30 min)

---

## Test Workflow (`test.yml`)

Runs on every push / PR:
- Installs Playwright + xvfb
- Runs `tests/smoke_echokit.py` end-to-end test
- 34+ assertions covering recording, mocking, scope, match modes, themes, JSON highlighter, clipboard, blocklist

---

## Release Workflow (`release.yml`)

**Trigger**: Push a tag matching `v*.*.*` (e.g., `v1.6.0`, `v2.0.0`)

**What it does:**
1. Validates all required Chrome Web Store secrets are configured
2. Syncs `extension/manifest.json` version with git tag
3. Builds production zip file
4. Creates GitHub Release with auto-generated notes
5. **Uploads to Chrome Web Store** (fully automated)
6. **Publishes immediately** (enters review queue)

**Required GitHub Secrets** (one-time setup):
- `CWS_EXTENSION_ID` - Your Chrome extension ID
- `CWS_CLIENT_ID` - OAuth client ID
- `CWS_CLIENT_SECRET` - OAuth client secret
- `CWS_REFRESH_TOKEN` - OAuth refresh token

⚠️ **The workflow will fail if any secrets are missing** - this ensures you never accidentally skip Chrome Web Store publishing.

**First-time setup**: Follow **[CHROME_WEB_STORE_SETUP.md](CHROME_WEB_STORE_SETUP.md)** for detailed instructions.

---

## Development Conventions

- `main` branch is always releasable
- Bug fixes → `vX.Y.Z+1` patch release from `main`
- New features → feature branch → PR → review → merge → tag
- All releases are automatically published to Chrome Web Store
