// Smoke test for echokit-server CLI.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer } = require('../lib/server');
const { computeMatchKeys } = require('../lib/match');

function fixture() {
  // Pre-compute the matchKeys for the request used in the test, so the
  // server's index lookup (which uses matchKeys[mode]) finds the mock.
  const get1 = computeMatchKeys('GET', 'http://_/api/users', null);
  const post1 = computeMatchKeys('POST', 'http://_/api/login', JSON.stringify({ u: 'a' }));
  const chain1 = computeMatchKeys('GET', 'http://_/api/chain', null);
  return {
    version: 2,
    interactions: [
      {
        id: 'int_users', hash: get1.strict, matchKeys: get1, matchMode: 'strict',
        method: 'GET', url: 'http://_/api/users',
        responseStatus: 200, responseHeaders: {}, responseBody: '{"users":[{"id":1}]}',
        mockEnabled: true, timestamp: Date.now()
      },
      {
        id: 'int_login', hash: post1.strict, matchKeys: post1, matchMode: 'strict',
        method: 'POST', url: 'http://_/api/login', requestBody: JSON.stringify({ u: 'a' }),
        responseStatus: 201, responseHeaders: { 'x-mock': 'yes' }, responseBody: '{"token":"abc"}',
        mockEnabled: true, timestamp: Date.now()
      },
      {
        id: 'int_chain', hash: chain1.strict, matchKeys: chain1, matchMode: 'strict',
        method: 'GET', url: 'http://_/api/chain',
        responseStatus: 200, responseHeaders: {}, responseBody: '{"v":0}',
        mockEnabled: true, timestamp: Date.now(),
        mockChain: [
          { status: 200, body: '{"v":1}', headers: {} },
          { status: 201, body: '{"v":2}', headers: {} }
        ],
        mockChainCursor: 0,
        mockChainLoop: true
      }
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

(async () => {
  const tmp = path.join(os.tmpdir(), `echokit-test-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(fixture(), null, 2));

  const port = 19000 + Math.floor(Math.random() * 500);
  const { server } = await startServer({
    file: tmp, port, host: '127.0.0.1',
    defaultLatency: 0, strict: false, ci: false, watch: false, quiet: true
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
    // Without ignore-query mode set, this is unmatched. Default modes try strict first, then path-wildcard etc.
    expect('strict mode does not match query variant', r4.status === 404, JSON.stringify(r4));
  } finally {
    server.close();
    fs.unlinkSync(tmp);
  }

  console.log(`\nPassed: ${pass}  Failed: ${fail}`);
  process.exit(fail ? 1 : 0);
})();
