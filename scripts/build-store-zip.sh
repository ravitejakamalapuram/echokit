#!/usr/bin/env bash
# EchoKit — Chrome Web Store build script
# Reads version from /app/extension/manifest.json, validates the extension,
# zips it (excluding dev-only files), and drops it into /app/store/.
#
# Usage:
#   bash /app/scripts/build-store-zip.sh             # build with current manifest version
#   bash /app/scripts/build-store-zip.sh --bump      # bump patch version, rebuild, write back to manifest

set -euo pipefail

EXT_DIR="/app/extension"
STORE_DIR="/app/store"
MANIFEST="$EXT_DIR/manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "✗ manifest.json not found at $MANIFEST" >&2
  exit 1
fi

# ---- Bump patch version (optional) ----
if [[ "${1-}" == "--bump" ]]; then
  CUR=$(node -e "console.log(require('$MANIFEST').version)")
  IFS='.' read -r MAJ MIN PATCH <<< "$CUR"
  NEXT="${MAJ}.${MIN}.$((PATCH+1))"
  node -e "
    const fs=require('fs'), p='$MANIFEST';
    const m=JSON.parse(fs.readFileSync(p,'utf8'));
    m.version='$NEXT';
    fs.writeFileSync(p, JSON.stringify(m, null, 2)+'\n');
  "
  echo "↗ bumped manifest version: $CUR → $NEXT"
fi

VERSION=$(node -e "console.log(require('$MANIFEST').version)")
NAME=$(node -e "console.log((require('$MANIFEST').name||'echokit').toLowerCase().replace(/[^a-z0-9]+/g,'-'))")
ZIP_NAME="${NAME}-v${VERSION}.zip"
OUT="$STORE_DIR/$ZIP_NAME"

mkdir -p "$STORE_DIR"

# ---- Lint pass: every JS file must be valid ----
echo "→ syntax-checking JS files…"
SYNTAX_OK=1
while IFS= read -r -d '' f; do
  if ! node -c "$f" 2>/dev/null; then
    echo "  ✗ syntax error: $f" >&2
    SYNTAX_OK=0
  fi
done < <(find "$EXT_DIR" -type f -name '*.js' -print0)
if [[ $SYNTAX_OK -ne 1 ]]; then
  echo "✗ aborting: fix JS syntax errors first" >&2
  exit 2
fi

# ---- Verify required manifest fields ----
node -e "
  const m = require('$MANIFEST');
  const missing = ['manifest_version','name','version','description','icons','action','background','permissions']
    .filter(k => !m[k]);
  if (missing.length) { console.error('✗ manifest missing fields:', missing.join(', ')); process.exit(3); }
  if (m.manifest_version !== 3) { console.error('✗ manifest_version must be 3'); process.exit(3); }
  console.log('✓ manifest valid (' + Object.keys(m.permissions||[]).length + ' fields, MV3)');
"

# ---- Zip ----
rm -f "$OUT"
echo "→ zipping $EXT_DIR → $OUT"
( cd "$EXT_DIR" && zip -rq "$OUT" . \
    -x '*.DS_Store' \
    -x '*.swp' '*.swo' \
    -x 'node_modules/*' \
    -x '.git/*' '.gitignore' \
    -x '*.test.js' '*.spec.js' \
    -x 'tests/*' \
    -x '*.map' \
    -x 'README.dev.md' )

SIZE=$(du -h "$OUT" | cut -f1)
echo ""
echo "✓ built $ZIP_NAME ($SIZE)"
echo "  → $OUT"
echo ""
echo "Next: upload to https://chrome.google.com/webstore/devconsole"
