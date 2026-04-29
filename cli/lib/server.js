// echokit-server core — replay EchoKit recordings as a real HTTP/WS/SSE server.

'use strict';

const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { computeMatchKeys, MODES } = require('./match');

function loadInteractions(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const items = Array.isArray(raw) ? raw : (raw.interactions || []);
  return items.filter(i => i && i.method && i.url);
}

function buildIndex(interactions) {
  const httpIndex = {};
  const wsIndex = {};   // method:WS → keyed by path-wildcard
  const sseIndex = {};  // method:SSE → keyed by path-wildcard
  for (const it of interactions) {
    if (it.mockEnabled === false) continue;
    const mode = it.matchMode || 'strict';
    const keys = it.matchKeys || computeMatchKeys(it.method, it.url, it.requestBody);
    const key = keys[mode] || keys.strict;
    if (!key) continue;
    if (it.method === 'WS') {
      const k = keys['path-wildcard'] || key;
      (wsIndex[k] || (wsIndex[k] = [])).push(it);
      continue;
    }
    if (it.method === 'SSE') {
      const k = keys['path-wildcard'] || key;
      (sseIndex[k] || (sseIndex[k] = [])).push(it);
      continue;
    }
    const bucket = httpIndex[mode] || (httpIndex[mode] = {});
    (bucket[key] || (bucket[key] = [])).push(it);
  }
  for (const m of Object.keys(httpIndex)) {
    for (const k of Object.keys(httpIndex[m])) {
      httpIndex[m][k].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
  }
  return { httpIndex, wsIndex, sseIndex };
}

function pickHttpMock(httpIndex, keys, cursors, hits) {
  for (const mode of MODES) {
    const bucket = httpIndex[mode];
    if (!bucket) continue;
    const versions = bucket[keys[mode]];
    if (!versions || !versions.length) continue;
    const active = versions[0].activeVersionId;
    let pick = null;
    if (active) pick = versions.find(v => v.id === active);
    if (!pick) pick = versions[0];

    let step = null;
    if (pick.mockChain && pick.mockChain.length > 0) {
      const cur = cursors[pick.id] || 0;
      const idx = pick.mockChainLoop !== false
        ? cur % pick.mockChain.length
        : Math.min(cur, pick.mockChain.length - 1);
      step = pick.mockChain[idx];
      cursors[pick.id] = cur + 1;
    }
    hits[pick.id] = (hits[pick.id] || 0) + 1;
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

function pickWSMock(wsIndex, keys, hits) {
  const k = keys['path-wildcard'] || keys.strict;
  const versions = wsIndex[k];
  if (!versions || !versions.length) return null;
  const pick = versions[0];
  hits[pick.id] = (hits[pick.id] || 0) + 1;
  return pick;
}

function pickSSEMock(sseIndex, keys, hits) {
  const k = keys['path-wildcard'] || keys.strict;
  const versions = sseIndex[k];
  if (!versions || !versions.length) return null;
  const pick = versions[0];
  hits[pick.id] = (hits[pick.id] || 0) + 1;
  return pick;
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

// ---------- WebSocket handling (zero-dep) ----------
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsAcceptKey(clientKey) {
  return crypto.createHash('sha1').update(clientKey + WS_GUID).digest('base64');
}

function encodeWSFrame(payloadStr, opcode = 0x1) {
  const payload = Buffer.from(String(payloadStr), 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function handleWSUpgrade(req, socket, mock, opts) {
  const clientKey = req.headers['sec-websocket-key'];
  if (!clientKey) { socket.destroy(); return; }
  const accept = wsAcceptKey(clientKey);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n` +
    '\r\n'
  );
  // Drain incoming client frames (we don't validate them).
  socket.on('data', () => {});
  socket.on('error', () => {});

  let frames;
  try { frames = (JSON.parse(mock.responseBody || '{}').frames || []).filter(f => f.dir === 'in'); }
  catch { frames = []; }
  if (!frames.length) return;

  const loop = !!mock.wsLoop;
  let stopped = false;
  socket.on('close', () => { stopped = true; });

  const replay = async () => {
    do {
      let lastT = 0;
      for (const f of frames) {
        if (stopped) return;
        const wait = Math.max(0, (f.t || 0) - lastT);
        if (wait) await delay(wait);
        lastT = f.t || lastT;
        if (stopped) return;
        try { socket.write(encodeWSFrame(typeof f.data === 'string' ? f.data : JSON.stringify(f.data))); }
        catch { return; }
      }
      if (loop) await delay(50);
    } while (loop && !stopped);
    // Close cleanly
    try { socket.write(encodeWSFrame('', 0x8)); } catch {}
    try { socket.end(); } catch {}
  };
  replay().catch(() => {});
}

// ---------- SSE handling ----------
function handleSSE(res, mock) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...corsHeaders()
  });
  let frames;
  try { frames = (JSON.parse(mock.responseBody || '{}').frames || []).filter(f => f.dir === 'in'); }
  catch { frames = []; }
  if (!frames.length) { res.end(); return; }

  let stopped = false;
  res.on('close', () => { stopped = true; });

  const replay = async () => {
    let lastT = 0;
    for (const f of frames) {
      if (stopped) return;
      const wait = Math.max(0, (f.t || 0) - lastT);
      if (wait) await delay(wait);
      lastT = f.t || lastT;
      const data = typeof f.data === 'string' ? f.data : JSON.stringify(f.data);
      // Each SSE message: data: <line>\n\n. Split on newlines so multi-line data is encoded properly.
      const out = data.split(/\r?\n/).map(l => `data: ${l}`).join('\n') + '\n\n';
      try { res.write(out); } catch { return; }
    }
    res.end();
  };
  replay().catch(() => {});
}

// ---------- Coverage report ----------
function buildReport({ interactions, hits, unmatched, startedAt }) {
  const mocks = interactions.map(it => ({
    id: it.id,
    method: it.method,
    url: it.url,
    hash: it.hash,
    matchMode: it.matchMode || 'strict',
    hits: hits[it.id] || 0
  }));
  const totalRequests = mocks.reduce((s, m) => s + m.hits, 0) + unmatched.length;
  const matchedRequests = totalRequests - unmatched.length;
  const usedMocks = mocks.filter(m => m.hits > 0).length;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    totalMocks: mocks.length,
    usedMocks,
    unusedMocks: mocks.filter(m => m.hits === 0),
    totalRequests,
    matchedRequests,
    unmatchedRequests: unmatched.length,
    coverage: mocks.length === 0 ? 0 : Math.round((usedMocks / mocks.length) * 1000) / 10,
    mocks: mocks.sort((a, b) => b.hits - a.hits),
    unmatched
  };
}

async function startServer(opts) {
  const {
    file, port, host, defaultLatency, strict, ci, watch, quiet, reportPath
  } = opts;

  let interactions = loadInteractions(file);
  let { httpIndex, wsIndex, sseIndex } = buildIndex(interactions);
  const cursors = {};
  const hits = {};
  const unmatched = [];
  const startedAt = Date.now();

  if (watch) {
    fs.watchFile(file, { interval: 500 }, () => {
      try {
        interactions = loadInteractions(file);
        ({ httpIndex, wsIndex, sseIndex } = buildIndex(interactions));
        Object.keys(cursors).forEach(k => delete cursors[k]);
        if (!quiet) console.log(`↻ reloaded ${interactions.length} mocks from ${file}`);
      } catch (e) {
        console.error('✗ reload failed:', e.message);
      }
    });
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders()); return res.end(); }

    if (req.url === '/__health' || req.url === '/__healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders() });
      return res.end(JSON.stringify({ ok: true, mocks: interactions.length }));
    }
    if (req.url === '/__coverage') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders() });
      return res.end(JSON.stringify(buildReport({ interactions, hits, unmatched, startedAt }), null, 2));
    }

    const body = await readBody(req);
    const url = req.url;
    const accept = req.headers['accept'] || '';

    // SSE detection: matched interaction has method=SSE OR client requested text/event-stream
    if (accept.includes('text/event-stream')) {
      const sseKeys = computeMatchKeys('SSE', url, '');
      const sseMock = pickSSEMock(sseIndex, sseKeys, hits);
      if (sseMock) return handleSSE(res, sseMock);
    }

    const keys = computeMatchKeys(req.method, url, body);
    const m = pickHttpMock(httpIndex, keys, cursors, hits);

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
    if (m.errorMode === 'timeout') { return; }

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

  // WebSocket upgrade
  server.on('upgrade', (req, socket) => {
    const wsKeys = computeMatchKeys('WS', req.url, '');
    const mock = pickWSMock(wsIndex, wsKeys, hits);
    if (!mock) {
      unmatched.push({ method: 'WS', url: req.url, ts: Date.now() });
      if (!quiet) console.log(`  ✗ WS ${req.url}  → no mock`);
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    if (!quiet) console.log(`  ✓ WS ${req.url}  → mocked`);
    handleWSUpgrade(req, socket, mock, opts);
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
  if (reportPath) console.log(`  coverage report → ${reportPath}`);

  const writeReport = () => {
    if (!reportPath) return;
    try {
      const report = buildReport({ interactions, hits, unmatched, startedAt });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`✓ wrote coverage report (${report.usedMocks}/${report.totalMocks} mocks used, ${report.unmatchedRequests} unmatched)`);
    } catch (e) { console.error('✗ failed to write coverage report:', e.message); }
  };

  const onExit = (code) => {
    writeReport();
    if (ci && unmatched.length) {
      console.error(`\n✗ ${unmatched.length} unmatched request(s):`);
      for (const u of unmatched) console.error(`  ${u.method} ${u.url}`);
    }
    if (strict && unmatched.length) process.exit(code || 3);
  };
  process.on('SIGINT', () => { console.log('\n↓ shutting down'); onExit(0); process.exit(0); });
  process.on('SIGTERM', () => { onExit(0); process.exit(0); });
  process.on('beforeExit', () => writeReport());

  return {
    server,
    getUnmatched: () => unmatched.slice(),
    getReport: () => buildReport({ interactions, hits, unmatched, startedAt }),
    writeReport
  };
}

module.exports = { startServer, loadInteractions, buildIndex, buildReport };
