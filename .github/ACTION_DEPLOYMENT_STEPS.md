# EchoKit Action - Deployment Steps

## Repository Location

All files are ready at: `/tmp/echokit-action/`

Files included:
- `action.yml` - The GitHub Action definition
- `README.md` - Documentation
- `LICENSE` - MIT License
- `.git/` - Git repository (initialized and committed)

---

## Step 1: Create GitHub Repository

1. Go to: **https://github.com/new**
2. **Repository name:** `echokit-action`
3. **Description:** `GitHub Action for running EchoKit mock server in CI/CD with coverage tracking`
4. **Visibility:** **Public**
5. **DO NOT** initialize with README, .gitignore, or license (we already have them)
6. Click **"Create repository"**

---

## Step 2: Push Code

After creating the repository, run these commands:

```bash
cd /tmp/echokit-action
git remote add origin https://github.com/ravitejakamalapuram/echokit-action.git
git branch -M main
git push -u origin main
```

---

## Step 3: Create Release Tags

```bash
cd /tmp/echokit-action
git tag -a v1.0.0 -m "Release v1.0.0 - Initial EchoKit GitHub Action"
git push origin v1.0.0
git tag v1 -f
git push origin v1 -f
```

The `v1` tag is important - it allows users to reference `@v1` in their workflows.

---

## Step 4: Publish to GitHub Marketplace (Optional)

1. Go to your repository: **https://github.com/ravitejakamalapuram/echokit-action**
2. Click **"Releases"** on the right sidebar
3. Click **"Create a new release"**
4. Choose tag: `v1.0.0`
5. Release title: `v1.0.0 - Initial Release`
6. Description:

```
## Features

- Start/stop EchoKit mock server in GitHub Actions
- Automatic coverage tracking
- PR coverage comments with detailed breakdown
- Strict mode to fail on unmatched requests
- JSON and markdown report formats
- Zero-config - just point to your EchoKit export JSON

## Usage

See README.md for examples.

## Related

- EchoKit Extension: https://github.com/ravitejakamalapuram/echokit
- echokit-server: https://www.npmjs.com/package/echokit-server
```

7. Check: ✅ **"Publish this Action to the GitHub Marketplace"**
8. Choose category: **Continuous Integration**
9. Click **"Publish release"**

---

## Step 5: Verify It Works

The action will be live at:
- **Repository:** https://github.com/ravitejakamalapuram/echokit-action
- **Usage:** `uses: ravitejakamalapuram/echokit-action@v1`

---

## Done! ✅

Users can now add this to their workflows:

```yaml
- uses: ravitejakamalapuram/echokit-action@v1
  with:
    mocks-file: tests/fixtures/echokit-export.json
```
