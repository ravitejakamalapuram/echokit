#!/bin/bash
#
# Build script for extension/injected.js
# 
# Bundles extension/injected-src.js (which imports shared/matcher.js) 
# into extension/injected.js (standalone file with no imports).
#
# This ensures the matcher logic stays DRY across:
# - extension/shared/matcher.js (used by background.js)
# - extension/injected.js (bundled, runs in main world)  
# - cli/lib/match.js (CLI tool)
#
# Usage:
#   ./scripts/build-injected.sh          # Build once
#   ./scripts/build-injected.sh --watch  # Watch mode for development
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

INPUT="$PROJECT_ROOT/extension/injected-src.js"
OUTPUT="$PROJECT_ROOT/extension/injected.js"

# Check if input file exists
if [ ! -f "$INPUT" ]; then
  echo "❌ Error: Source file not found: $INPUT"
  echo "   Did you forget to rename injected.js to injected-src.js?"
  exit 1
fi

# Detect watch mode
WATCH_FLAG=""
if [ "$1" = "--watch" ]; then
  WATCH_FLAG="--watch"
  echo "👀 Watching for changes to $INPUT..."
fi

# Run esbuild
echo "🔨 Building $OUTPUT..."
# Use --platform=browser to avoid Node.js-specific code
# Don't use --format=iife since our source already has an IIFE wrapper
npx esbuild "$INPUT" \
  --bundle \
  --platform=browser \
  --target=chrome100 \
  --outfile="$OUTPUT" \
  --banner:js="// ⚠️  AUTO-GENERATED FILE - DO NOT EDIT
// This file is generated from extension/injected-src.js
// Run 'npm run build' or './scripts/build-injected.sh' to regenerate
// Source: extension/injected-src.js
" \
  $WATCH_FLAG

# Fix esbuild renaming normalizeUrl -> normalizeUrl2
# This happens because esbuild tries to avoid naming conflicts
sed -i '' 's/normalizeUrl2/normalizeUrl/g' "$OUTPUT"

if [ -z "$WATCH_FLAG" ]; then
  echo "✅ Build complete: $OUTPUT"
  echo ""
  echo "📦 Bundle size:"
  ls -lh "$OUTPUT" | awk '{print "   " $5}'
fi
