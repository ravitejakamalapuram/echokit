'use strict';

const { corsHeaders } = require('../lib/server');

let pass = 0;
let fail = 0;

function expect(name, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`[OK ] ${name}`);
  } else {
    fail++;
    console.error(`[FAIL] ${name} ${detail}`);
  }
}

function testCorsHeaders() {
  const headers = corsHeaders();

  expect('corsHeaders returns an object', typeof headers === 'object' && headers !== null);
  expect('Access-Control-Allow-Origin is *', headers['Access-Control-Allow-Origin'] === '*');
  expect('Access-Control-Allow-Methods allows expected methods', headers['Access-Control-Allow-Methods'] === 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  expect('Access-Control-Allow-Headers is *', headers['Access-Control-Allow-Headers'] === '*');
  expect('Access-Control-Max-Age is 86400', headers['Access-Control-Max-Age'] === '86400');
}

console.log('--- Running Unit Tests ---');

try {
  testCorsHeaders();
} catch (e) {
  fail++;
  console.error('[FAIL] Exception during tests:', e.message);
}

console.log(`\nUnit Tests Passed: ${pass}  Failed: ${fail}`);
if (fail > 0) {
  process.exit(1);
}
