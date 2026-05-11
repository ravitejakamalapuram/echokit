# 🤖 Automated Release on Main Branch

EchoKit now has **fully automated releases** when merging to `main`!

## 🚀 How It Works

### Workflow Chain

```
PR Merge to main
    ↓
.github/workflows/auto-release.yml
    ↓ (reads extension/manifest.json version)
    ↓ (creates tag v*.*.* if not exists)
    ↓
.github/workflows/release.yml
    ↓ (triggered by tag)
    ↓ (builds zip)
    ↓ (creates GitHub Release)
    ↓ (uploads to Chrome Web Store)
    ↓
✅ Published!
```

## 📋 Publishing a New Version

### Option 1: Automated (Recommended)

1. **Update version in your PR:**
   ```json
   // extension/manifest.json
   {
     "version": "1.7.0"  // ← Increment this
   }
   ```

2. **Merge PR to main**
   - The `auto-release.yml` workflow detects the version change
   - Automatically creates tag `v1.7.0`
   - The `release.yml` workflow is triggered by the tag
   - Extension is built and published to Chrome Web Store

3. **Done!** 🎉

### Option 2: Manual Tag (Legacy)

```bash
git tag v1.7.0
git push origin v1.7.0
```

This triggers `release.yml` directly (skips `auto-release.yml`).

## ⚙️ Configuration

### Required GitHub Secrets

For Chrome Web Store publishing to work, set these in repository settings:
- `CWS_EXTENSION_ID`
- `CWS_CLIENT_ID`
- `CWS_CLIENT_SECRET`
- `CWS_REFRESH_TOKEN`

See `.github/CHROME_WEB_STORE_SETUP.md` for setup instructions.

### Workflow Triggers

**auto-release.yml** triggers on:
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'extension/**'
      - '!extension/**/*.md'
```

**release.yml** triggers on:
```yaml
on:
  push:
    tags: ['v*.*.*']
```

## 🔍 Monitoring

### Check Workflow Status

```bash
gh run list --workflow=auto-release.yml --limit 5
gh run list --workflow=release.yml --limit 5
```

### View Workflow Logs

```bash
gh run view  # Shows latest run
gh run view <run-id> --log
```

### GitHub Actions UI

https://github.com/ravitejakamalapuram/echokit/actions

## 🛡️ Safety Features

- ✅ **Idempotent**: Won't create duplicate tags for the same version
- ✅ **Smart skipping**: Only triggers on `extension/` changes (not docs)
- ✅ **Version sync**: Tag name always matches manifest.json version
- ✅ **Atomic**: Tag creation and release are separate workflows

## 🎯 Example Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes + bump version
vim extension/manifest.json  # "version": "1.7.0"
git commit -am "feat: add new feature"

# 3. Push and create PR
git push -u origin feature/new-feature
gh pr create --fill

# 4. Merge PR (via GitHub UI or CLI)
gh pr merge --squash --delete-branch

# 5. Wait ~2 minutes
# ✅ Tag v1.7.0 created automatically
# ✅ GitHub Release created
# ✅ Chrome Web Store updated
# ✅ Extension published!
```

## 📊 Version History

Tags and releases: https://github.com/ravitejakamalapuram/echokit/releases

## ❓ FAQ

**Q: What if I merge to main without updating the version?**  
A: The workflow checks if the tag already exists. If it does, it skips tag creation and does nothing.

**Q: Can I still create tags manually?**  
A: Yes! Manual tags will still trigger `release.yml` normally.

**Q: How do I skip auto-release for a specific commit?**  
A: Add `[skip-release]` to your commit message, or only change non-`extension/` files.

**Q: What if Chrome Web Store secrets are missing?**  
A: The `release.yml` workflow will fail with clear instructions on how to set them up.

## 🔧 Troubleshooting

### Tag already exists error

```bash
# List existing tags
git tag -l

# Delete tag locally and remotely (if needed)
git tag -d v1.6.0
git push origin :refs/tags/v1.6.0

# Next merge to main will recreate it
```

### Workflow not triggering

1. Check if paths filter matches: `extension/**` files changed?
2. Check workflow runs: https://github.com/ravitejakamalapuram/echokit/actions
3. Verify you pushed to `main` (not a different branch)

---

**Created:** 2026-05-11  
**Updated:** 2026-05-11  
**Status:** ✅ Active
