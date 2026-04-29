# EchoKit build & maintenance scripts

## `build-store-zip.sh`

One-shot script that produces the Chrome Web Store upload zip from `/app/extension`.

```bash
# Build with the current manifest version
bash /app/scripts/build-store-zip.sh

# Bump the patch version, then build
bash /app/scripts/build-store-zip.sh --bump
```

It will:

1. (optional) Bump the patch version in `manifest.json`
2. `node -c` every JS file in the extension to catch syntax errors before publish
3. Verify required Manifest V3 fields are present
4. Zip `/app/extension` into `/app/store/echokit-…-v<version>.zip`,
   excluding `.DS_Store`, `.git`, `node_modules`, `*.test.js`, `*.spec.js`, `tests/`, source-maps
5. Print the path + size + the next-step URL for the dev console

Then upload the zip at <https://chrome.google.com/webstore/devconsole>.
