#!/usr/bin/env python3
import subprocess
import os

os.chdir('/Users/rkamalapuram/git-personal/echokit')

# Get original file from git
result = subprocess.run(['git', 'show', 'HEAD:extension/injected.js'], 
                       capture_output=True, text=True)
original_lines = result.stdout.splitlines(keepends=True)

# Build new file
header = [
    '// EchoKit — MAIN-world injected script (SOURCE FILE).\n',
    '// This file is bundled by esbuild into extension/injected.js\n',
    '// Run: npm run build  or  ./scripts/build-injected.sh\n',
    '//\n',
    '// Hooks window.fetch + XMLHttpRequest. Records real traffic (when recording is on)\n',
    '// and serves mocked responses (when mocking is on AND a match exists).\n',
    '\n',
    "import { computeMatchKeys, normalizeBody, parseGraphQL } from './shared/matcher.js';\n",
    '\n',
]

# Keep original lines 1-27 (IIFE start, logger, state) - skip first 3 comment lines
# Then skip lines 28-117 (inlined matcher functions)
# Then add lines 118+ (rest of the file)
output = header + original_lines[3:27] + original_lines[117:]

with open('extension/injected-src.js', 'w') as f:
    f.writelines(output)

print(f'✅ Created injected-src.js: {len(output)} lines')
print(f'   Removed {117-27} lines of inlined matcher code')
