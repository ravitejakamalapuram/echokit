# EchoKit — Scripts

Build, deployment, and developer utility scripts.

---

## `build-store-zip.sh`

Produces a Chrome Web Store upload zip from `extension/`.

```bash
# Build with the current manifest version
bash scripts/build-store-zip.sh

# Bump the patch version in manifest.json, then build
bash scripts/build-store-zip.sh --bump
```

What it does:
1. Optionally bumps the patch version in `manifest.json` (`--bump`)
2. Runs `node -c` on every JS file to catch syntax errors before publish
3. Verifies required Manifest V3 fields are present
4. Zips `extension/` into `store/echokit-…-v<version>.zip`, excluding `.DS_Store`, `.git`, `node_modules`, `*.test.js`, `*.spec.js`, `tests/`, source maps
5. Prints the output path, file size, and the Chrome Web Store dev console URL

Upload the resulting zip at: <https://chrome.google.com/webstore/devconsole>

---

## `test-cws-auth.sh`

Validates Chrome Web Store OAuth credentials before a CI publish run.

```bash
CWS_CLIENT_ID=... CWS_CLIENT_SECRET=... CWS_REFRESH_TOKEN=... bash scripts/test-cws-auth.sh
```

Run this locally first whenever you rotate CWS credentials to confirm they work before pushing to CI.

---

## `setup/`

One-time infrastructure setup scripts. Run these manually during initial deployment — not part of the normal development workflow.

| Script | Purpose |
|--------|---------|
| `setup/setup-cloudflare-hosting.sh` | Automates Cloudflare Pages + Worker hosting setup |
| `setup/setup-dns-records.sh` | Adds DNS records for `echokit.dev` in Cloudflare (Worker + Pages routes) |
| `setup/setup-dns-via-api.sh` | Alternative: DNS setup via Cloudflare API (useful when CLI isn't configured) |
| `setup/update-email-addresses.sh` | Updates email routing rules for the `echokit.dev` domain |

These scripts require a Cloudflare API token with Zone and Worker permissions. See `docs/deployment/CLOUDFLARE_HOSTING_CI_CD_PLAN.md` for context.

---

## `tools/`

Developer utilities for one-off tasks.

| Script | Purpose |
|--------|---------|
| `tools/generate_screenshots.py` | Captures Chrome Web Store screenshots (1280×800) using Playwright. Outputs to `store/screenshots/`. |

### `generate_screenshots.py` usage

```bash
# Install dependencies (once)
pip install playwright
python3 -m playwright install chromium

# Run
python3 scripts/tools/generate_screenshots.py
```

Screenshots are saved to `store/screenshots/` and are used for the Chrome Web Store listing. See `store/screenshot-guide.md` for framing and caption guidance.
