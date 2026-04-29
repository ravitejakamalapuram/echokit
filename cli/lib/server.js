// echokit-server core — replay EchoKit recordings as a real HTTP server.

'use strict';

const fs = require('fs');
const http = require('http');
const { computeMatchKeys, MODES } = require('./match');

function loadInteractions(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Accept either { interactions: [...] } (EchoKit v2 export) or a bare array.
  const items = Array.isArray(raw) ? raw : (raw.interactions || []);
  return items.filter(i => i && i.method && i.url);
}

function buildIndex(interactions) {
  const index = {};
  for (const it of interactions) {
    if (it.mockEnabled === false) continue;
    if (it.method === 'WS' || it.method === 'SSE') continue; // no socket replay yet
    const mode = it.matchMode || 'strict';
    const keys = it.matchKeys || computeMatchKeys(it.method, it.url, it.requestBody);
    const key = keys[mode] || keys.strict;
    if (!key) continue;
    const bucket = index[mode] || (index[mode] = {});
    if (!bucket[key]) bucket[key] = [];
    bucket[key].push(it);
  }
  for (const m of Object.keys(index)) {
    for (const k of Object.keys(index[m])) {
      index[m][k].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
  }
  return index;
}

// In-memory cursors for mock chains: { [interactionId]: cursor }
function pickMock(index, keys, cursors) {
  for (const mode of MODES) {
    const bucket = index[mode];
    if (!bucket) continue;
    const versions = bucket[keys[mode]];
    if (!versions || !versions.length) continue;
    const active = versions[0].activeVersionId;
    let pick = null;
    if (active) pick = versions.find(v => v.id === active);
    if (!pick) pick = versions[0];

    // Resolve mock chain step (advance cursor on hit)
    let step = null;
    if (pick.mockChain && pick.mockChain.length > 0) {
      const cur = cursors[pick.id] || 0;
      const idx = pick.mockChainLoop !== false
        ? cur % pick.mockChain.length
        : Math.min(cur, pick.mockChain.length - 1);
      step = pick.mockChain[idx];
      cursors[pick.id] = cur + 1;
    }
    return {
      id: pick.id,
      method: pick.method,
      mode,
      status: step?.status ?? (pick.overrideStatus != null ? pick.overrideStatus : pick.responseStatus) ?? 200,
      body: step?.body ?? (pick.overrideBody != null ? pick.overrideBody : pick.responseBody) ?? '',
      headers: step?.headers ?? (pick.overrideHeaders || pick.responseHeaders || {}),
      latency: pick.mockLatency || 0,
      errorMode: pick.mockErrorMode || 'none'
    };
  }
  return null;
}

function delay(ms) { return new Promise(r => setTimeout(r, Math.max(0, ms | 0))); }

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  };
}

async function startServer(opts) {
  const { file, port, host, defaultLatency, strict, ci, watch, quiet } = opts;

  let interactions = loadInteractions(file);
  let index = buildIndex(interactions);
  const cursors = {};
  const unmatched = [];

  if (watch) {
    fs.watchFile(file, { interval: 500 }, () => {
      try {
        interactions = loadInteractions(file);
        index = buildIndex(interactions);
        Object.keys(cursors).forEach(k => delete cursors[k]);
        if (!quiet) console.log(`↻ reloaded ${interactions.length} mocks from ${file}`);
      } catch (e) {
        console.error('✗ reload failed:', e.message);
      }
    });
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      return res.end();
    }
    const body = await readBody(req);
    // Reconstruct a URL the matcher understands. Drop the host header so
    // callers can use either http://localhost:3001/api/x or any base.
    const url = req.url;
    const keys = computeMatchKeys(req.method, url, body);
    const m = pickMock(index, keys, cursors);

    if (!m) {
      unmatched.push({ method: req.method, url, ts: Date.now() });
      if (!quiet) console.log(`  ✗ ${req.method} ${url}  → no mock`);
      res.writeHead(404, { 'Content-Type': 'application/json', ...corsHeaders() });
      return res.end(JSON.stringify({
        error: 'echokit: no mock matched',
        method: req.method,
        url,
        triedModes: MODES
      }));
    }

    if (defaultLatency) await delay(defaultLatency);
    if (m.latency) await delay(m.latency);

    if (m.errorMode === 'network') { req.destroy(); return; }
    if (m.errorMode === 'timeout') { /* hang forever */ return; }

    let status = m.status;
    if (m.errorMode === '4xx') status = 400;
    else if (m.errorMode === '5xx') status = 500;

    const headers = { ...corsHeaders(), ...(m.headers || {}) };
    if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }

    let bodyOut = m.body;
    if (typeof bodyOut !== 'string') {
      try { bodyOut = JSON.stringify(bodyOut); } catch { bodyOut = String(bodyOut); }
    }

    if (!quiet) console.log(`  ✓ ${req.method} ${url}  → ${status} (${m.mode})`);
    res.writeHead(status, headers);
    res.end(bodyOut);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  console.log(`✓ echokit-server listening on http://${host}:${port}`);
  console.log(`  loaded ${interactions.length} interactions from ${file}`);
  if (defaultLatency) console.log(`  +${defaultLatency}ms latency`);
  if (strict) console.log(`  strict mode: will exit non-zero if any unmatched requests`);
  if (watch) console.log(`  watching ${file} for changes`);

  // Strict / CI mode: fail process on unmatched
  const onExit = (code) => {
    if (ci && unmatched.length) {
      console.error(`\n✗ ${unmatched.length} unmatched request(s):`);
      for (const u of unmatched) console.error(`  ${u.method} ${u.url}`);
    }
    if (strict && unmatched.length) process.exit(code || 3);
  };
  process.on('SIGINT', () => { console.log('\n↓ shutting down'); onExit(0); process.exit(0); });
  process.on('SIGTERM', () => { onExit(0); process.exit(0); });

  return { server, getUnmatched: () => unmatched.slice() };
}

module.exports = { startServer, loadInteractions, buildIndex };
