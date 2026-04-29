#!/usr/bin/env node
// echokit-server — headless mock server for EchoKit-exported JSON.

'use strict';

const fs = require('fs');
const path = require('path');
const { startServer } = require('../lib/server');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--port') args.port = Number(argv[++i]);
    else if (a === '--host') args.host = argv[++i];
    else if (a === '--latency') args.defaultLatency = Number(argv[++i]);
    else if (a === '--strict') args.strict = true;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--ci') args.ci = true;
    else if (a === '--watch') args.watch = true;
    else if (a === '--report') args.reportPath = argv[++i];
    else if (a.startsWith('--')) { console.error('Unknown flag:', a); process.exit(2); }
    else args._.push(a);
  }
  return args;
}

function help() {
  console.log(`
echokit-server — headless mock server for EchoKit recordings

Usage:
  echokit-server <export.json> [options]

Options:
  --port <n>          listen port (default: 3001)
  --host <h>          bind host (default: 127.0.0.1)
  --latency <ms>      add base latency to every response
  --strict            exit non-zero if a request does not match any mock
  --ci                same as --strict, plus dump unmatched requests on exit
  --watch             reload mocks when the file changes
  --report <path>     write a coverage JSON to this path on exit (also at /__coverage)
  --quiet             suppress per-request logs
  -h, --help          show this help

Endpoints (built-in):
  /__health           liveness probe → { ok: true, mocks: <n> }
  /__coverage         live coverage JSON

Environment:
  PORT                same as --port
  ECHOKIT_EXPORT      path to export JSON (alternative to positional arg)
  ECHOKIT_REPORT      path for coverage JSON (alternative to --report)
`);
}

const args = parseArgs(process.argv);
if (args.help) { help(); process.exit(0); }

const file = args._[0] || process.env.ECHOKIT_EXPORT;
if (!file) {
  console.error('✗ missing required <export.json>'); help(); process.exit(2);
}
const abs = path.resolve(process.cwd(), file);
if (!fs.existsSync(abs)) {
  console.error('✗ file not found:', abs); process.exit(2);
}

const opts = {
  file: abs,
  port: args.port || Number(process.env.PORT) || 3001,
  host: args.host || '127.0.0.1',
  defaultLatency: args.defaultLatency || 0,
  strict: !!(args.strict || args.ci),
  ci: !!args.ci,
  watch: !!args.watch,
  quiet: !!args.quiet,
  reportPath: args.reportPath || process.env.ECHOKIT_REPORT || null
};
if (opts.reportPath) opts.reportPath = path.resolve(process.cwd(), opts.reportPath);

startServer(opts).catch(err => {
  console.error('✗ failed to start:', err.message);
  process.exit(1);
});
