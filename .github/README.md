# Release pipeline

## Test workflow (`test.yml`)
Runs on every push / PR — installs Playwright + xvfb, runs `tests/smoke_echokit.py` end-to-end against the unpacked extension. 34+ assertions cover recording, mocking, scope, match modes, themes, JSON highlighter, clipboard, blocklist.

## Release workflow (`release.yml`)
Triggered by pushing a tag `v1.2.0`, `v1.3.0`, etc.

1. Checks out the repo.
2. Rewrites `extension/manifest.json` with the tag version.
3. Zips `extension/` → `echokit-vX.Y.Z.zip`.
4. Attaches the zip to a GitHub Release with auto-generated notes.
5. (Optional) Publishes to the Chrome Web Store if secrets are set.

### How to cut a release manually
```bash
git tag v1.3.0
git push origin v1.3.0
```
That's it.

### Enabling auto-publish to Chrome Web Store

You need four repo secrets (Settings → Secrets and variables → Actions):

| Secret | How to get it |
|---|---|
| `CWS_EXTENSION_ID` | From the Chrome Web Store dashboard after first manual submission. |
| `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET` | Create an OAuth 2.0 client in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Desktop app type). |
| `CWS_REFRESH_TOKEN` | One-time OAuth dance — full steps at [Chrome docs](https://developer.chrome.com/docs/webstore/using-api#setup). |

Without these, the `Publish` step is skipped; the workflow still produces a GitHub Release.

## Conventions
- `main` is always releasable.
- Patch bugs → `vX.Y.Z+1` from `main`.
- Feature work → feature branch → PR → review → merge → tag.
