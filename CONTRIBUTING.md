# Contributing to EchoKit

Thank you for contributing! This document covers the workflow — not the rules. For detailed code rules, see [`DEVELOPMENT_RULES.md`](DEVELOPMENT_RULES.md).

---

## Quick start

```bash
# Clone
git clone https://github.com/ravitejakamalapuram/echokit.git
cd echokit

# Load extension in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked" → select the echokit/extension/ folder

# Run tests
python3 tests/smoke_echokit.py   # E2E smoke tests (87 assertions)
node cli/test/test.js             # CLI unit tests
node tests/test-matcher.js        # Matcher unit tests
```

---

## Workflow

### 1. Branch

```bash
git checkout main && git pull origin main
git checkout -b feat/your-feature-name   # or fix/...
```

Branch naming: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`

### 2. Make changes

Follow [`DEVELOPMENT_RULES.md`](DEVELOPMENT_RULES.md). Key points:
- Scope all interaction reads through `getVisibleInteractions(tabId, host, scope)`
- Wrap `JSON.parse` and storage calls in try-catch
- Debounce text inputs at `DEBOUNCE_DELAY` (300 ms)
- New public functions need JSDoc

### 3. Test locally

```bash
# Required before opening a PR
python3 tests/smoke_echokit.py

# Load the extension unpacked and manually test your change
# in both the popup and DevTools panel
```

### 4. Commit with conventional prefixes

Version bumps are automatic — CI reads your commit prefix and bumps `manifest.json` on merge:

| Prefix | Result |
|--------|--------|
| `fix:` | Patch bump (1.10.3 → 1.10.4) |
| `feat:` | Minor bump (1.10.3 → 1.11.0) |
| `BREAKING:` | Major bump (1.10.3 → 2.0.0) |

```bash
git commit -m "fix: resolve hash mismatch on URLSearchParams body"
git commit -m "feat: add response delay randomisation option"
```

### 5. Open a PR

Use the PR template — it auto-fills when you open a pull request on GitHub. Fill out every section that applies; skip sections that don't.

### 6. After merge

CI automatically:
1. Detects version bump type from commit messages
2. Bumps `extension/manifest.json`
3. Creates a git tag
4. Creates a GitHub Release

---

## Folder structure

```
extension/    Chrome MV3 source
cli/          Node.js headless mock server (npm: echokit-server)
worker/       Cloudflare Worker (HMAC license validation)
tests/        Automated tests
scripts/      Build and deploy scripts
website/      Public HTML/CSS — served by Cloudflare Pages
docs/         Contributor documentation (not served publicly)
specs/        Product specs and feature designs
```

Full layout and all rules: [`DEVELOPMENT_RULES.md`](DEVELOPMENT_RULES.md)

---

## What not to do

- Don't rename `echokit:*` message types — breaks existing user installations
- Don't change `shared/matcher.js` without verifying record ↔ replay hash parity
- Don't add npm dependencies to `cli/` — it's intentionally zero-dependency
- Don't add new `manifest.json` permissions without explaining why in the PR
- Don't create working-notes files (`NOTES.md`, `PLAN.md`, etc.) — use inline JSDoc

---

## Getting help

- **Questions** → [GitHub Discussions](https://github.com/ravitejakamalapuram/echokit/discussions)
- **Bug** → [Open an issue](https://github.com/ravitejakamalapuram/echokit/issues/new?template=bug_report.md)
- **Feature idea** → [Open an issue](https://github.com/ravitejakamalapuram/echokit/issues/new?template=feature_request.md)
