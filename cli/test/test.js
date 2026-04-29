// Smoke test for echokit-server CLI.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const net = require('net');
const { startServer } = require('../lib/server');
const { computeMatchKeys } = require('../lib/match');

function fixture() {
  const get1 = computeMatchKeys('GET', 'http://_/api/users', null);
  const post1 = computeMatchKeys('POST', 'http://_/api/login', JSON.stringify({ u: 'a' }));
  const chain1 = computeMatchKeys('GET', 'http://_/api/chain', null);
  // WS/SSE: use the path that the server sees (req.url is just the path, not full URL)
  const ws1 = computeMatchKeys('WS', '/socket', '');
  const sse1 = computeMatchKeys('SSE', '/stream', '');
  return {
    version: 2,
    interactions: [
      { id: 'int_users', hash: get1.strict, matchKeys: get1, matchMode: 'strict',
        method: 'GET', url: 'http://_/api/users',
        responseStatus: 200, responseHeaders: {}, responseBody: '{"users":[{"id":1}]}',
        mockEnabled: true, timestamp: Date.now() },
      { id: 'int_login', hash: post1.strict, matchKeys: post1, matchMode: 'strict',
        method: 'POST', url: 'http://_/api/login', requestBody: JSON.stringify({ u: 'a' }),
        responseStatus: 201, responseHeaders: { 'x-mock': 'yes' }, responseBody: '{"token":"abc"}',
        mockEnabled: true, timestamp: Date.now() },
      { id: 'int_chain', hash: chain1.strict, matchKeys: chain1, matchMode: 'strict',
        method: 'GET', url: 'http://_/api/chain',
        responseStatus: 200, responseHeaders: {}, responseBody: '{"v":0}',
        mockEnabled: true, timestamp: Date.now(),
        mockChain: [
          { status: 200, body: '{"v":1}', headers: {} },
          { status: 201, body: '{"v":2}', headers: {} }
        ],
        mockChainCursor: 0, mockChainLoop: true },
      { id: 'int_ws', hash: ws1.strict, matchKeys: ws1, matchMode: 'path-wildcard',
        method: 'WS', url: '/socket',
        responseStatus: 101, responseHeaders: {},
        responseBody: JSON.stringify({ frames: [
          { dir: 'in', t: 0, data: 'hello' },
          { dir: 'in', t: 30, data: 'world' }
        ]}),
        mockEnabled: true, timestamp: Date.now() },
      { id: 'int_sse', hash: sse1.strict, matchKeys: sse1, matchMode: 'path-wildcard',
        method: 'SSE', url: '/stream',
        responseStatus: 200, responseHeaders: {},
        responseBody: JSON.stringify({ frames: [
          { dir: 'in', t: 0, data: 'tick-1' },
          { dir: 'in', t: 30, data: 'tick-2' }
        ]}),
        mockEnabled: true, timestamp: Date.now() },
      // Unused mock — should appear as unusedMocks in the coverage report
      { id: 'int_unused', hash: 'xyz', matchKeys: { strict: 'xyz', 'path-wildcard': 'xyz' }, matchMode: 'strict',
        method: 'GET', url: 'http://_/never',
        responseStatus: 200, responseHeaders: {}, responseBody: '{}',
        mockEnabled: true, timestamp: Date.now() }
    ]
  };
}

async function getJSON(url, init = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { method: init.method || 'GET', host: u.hostname, port: u.port, path: u.pathname + u.search, headers: init.headers || {} };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body }); }
      });
    });
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

// Minimal WS client: sends handshake, decodes incoming text frames.
function wsConnect(port, urlPath) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1', () => {
      const key = crypto.randomBytes(16).toString('base64');
      sock.write(
        `GET ${urlPath} HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    let received = Buffer.alloc(0);
    let handshaken = false;
    const messages = [];
    sock.on('data', chunk => {
      received = Buffer.concat([received, chunk]);
      if (!handshaken) {
        const idx = received.indexOf('\r\n\r\n');
        if (idx === -1) return;
        const head = received.slice(0, idx).toString('utf8');
        if (!head.startsWith('HTTP/1.1 101')) { sock.destroy(); return reject(new Error('bad handshake: ' + head.split('\r\n')[0])); }
        received = received.slice(idx + 4);
        handshaken = true;
      }
      // Decode unmasked frames (server → client)
      while (received.length >= 2) {
        const op = received[0] & 0x0f;
        let len = received[1] & 0x7f;
        let off = 2;
        if (len === 126) { len = received.readUInt16BE(2); off = 4; }
        else if (len === 127) { len = Number(received.readBigUInt64BE(2)); off = 10; }
        if (received.length < off + len) break;
        const payload = received.slice(off, off + len).toString('utf8');
        received = received.slice(off + len);
        if (op === 0x1) messages.push(payload);
        if (op === 0x8) { sock.end(); return; }
      }
    });
    sock.on('close', () => resolve(messages));
    sock.on('error', reject);
    setTimeout(() => { sock.end(); }, 500);
  });
}

function sseStream(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method: 'GET',
      headers: { Accept: 'text/event-stream' } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, ctype: res.headers['content-type'], body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
    setTimeout(() => req.destroy(), 600);
  });
}

(async () => {
  const tmp = path.join(os.tmpdir(), `echokit-test-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(fixture(), null, 2));
  const reportFile = path.join(os.tmpdir(), `echokit-report-${Date.now()}.json`);

  const port = 19000 + Math.floor(Math.random() * 500);
  const handle = await startServer({
    file: tmp, port, host: '127.0.0.1',
    defaultLatency: 0, strict: false, ci: false, watch: false, quiet: true,
    reportPath: reportFile
  });

  let pass = 0, fail = 0;
  const expect = (name, ok, detail = '') => {
    if (ok) { pass++; console.log(`[OK ] ${name}`); }
    else { fail++; console.log(`[FAIL] ${name}  ${detail}`); }
  };

  try {
    const r1 = await getJSON(`http://127.0.0.1:${port}/api/users`);
    expect('GET /api/users mocked', r1.status === 200 && r1.body.users?.[0]?.id === 1, JSON.stringify(r1));

    const r2 = await getJSON(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ u: 'a' })
    });
    expect('POST /api/login mocked w/ headers', r2.status === 201 && r2.headers['x-mock'] === 'yes', JSON.stringify(r2));

    const r3 = await getJSON(`http://127.0.0.1:${port}/api/missing`);
    expect('unmatched returns 404', r3.status === 404 && r3.body.error?.includes('no mock'), JSON.stringify(r3));

    const c1 = await getJSON(`http://127.0.0.1:${port}/api/chain`);
    const c2 = await getJSON(`http://127.0.0.1:${port}/api/chain`);
    const c3 = await getJSON(`http://127.0.0.1:${port}/api/chain`);
    expect('chain step 1', c1.status === 200 && c1.body.v === 1, JSON.stringify(c1));
    expect('chain step 2', c2.status === 201 && c2.body.v === 2, JSON.stringify(c2));
    expect('chain loops to step 1', c3.status === 200 && c3.body.v === 1, JSON.stringify(c3));

    const r4 = await getJSON(`http://127.0.0.1:${port}/api/users?ignored=true`);
    expect('strict mode does not match query variant', r4.status === 404, JSON.stringify(r4));

    // Health endpoint
    const h = await getJSON(`http://127.0.0.1:${port}/__health`);
    expect('__health returns ok', h.status === 200 && h.body.ok === true && h.body.mocks === 6, JSON.stringify(h));

    // SSE
    const sse = await sseStream(port, '/stream');
    expect('SSE returns text/event-stream', sse.ctype && sse.ctype.includes('text/event-stream'), JSON.stringify({ ctype: sse.ctype }));
    expect('SSE delivers frames', sse.body.includes('data: tick-1') && sse.body.includes('data: tick-2'), sse.body);

    // WS
    const wsMsgs = await wsConnect(port, '/socket');
    expect('WS handshake + frames replayed', wsMsgs.length >= 2 && wsMsgs[0] === 'hello' && wsMsgs[1] === 'world', JSON.stringify(wsMsgs));

    // Live coverage endpoint
    const cov = await getJSON(`http://127.0.0.1:${port}/__coverage`);
    expect('__coverage returns report', cov.status === 200 && cov.body.totalMocks === 6 && cov.body.usedMocks >= 5,
      JSON.stringify({ totalMocks: cov.body.totalMocks, usedMocks: cov.body.usedMocks, unmatched: cov.body.unmatchedRequests }));
    expect('__coverage lists unused mock', cov.body.unusedMocks.some(m => m.id === 'int_unused'),
      JSON.stringify(cov.body.unusedMocks));
  } finally {
    handle.writeReport();
    handle.server.close();
  }

  // Verify report file was written
  const reportExists = fs.existsSync(reportFile);
  expect('report file written on exit', reportExists);
  if (reportExists) {
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    expect('report has version 1', report.version === 1);
    expect('report counts unmatched', report.unmatchedRequests >= 1, `unmatched=${report.unmatchedRequests}`);
    expect('report counts hits per mock', report.mocks.find(m => m.id === 'int_chain')?.hits === 3,
      JSON.stringify(report.mocks.find(m => m.id === 'int_chain')));
    fs.unlinkSync(reportFile);
  }
  fs.unlinkSync(tmp);

  console.log(`\nPassed: ${pass}  Failed: ${fail}`);
  process.exit(fail ? 1 : 0);
})();
