const assert = require('assert');
const { corsHeaders } = require('../lib/server');

let pass = 0, fail = 0;

function expect(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`[OK ] ${name}`);
  } else {
    fail++;
    console.log(`[FAIL] ${name}  ${detail}`);
  }
}

console.log('Running Unit Tests...');

try {
  // Test corsHeaders
  const headers = corsHeaders();

  expect('corsHeaders returns an object', typeof headers === 'object' && headers !== null);
  expect('corsHeaders has Access-Control-Allow-Origin', headers['Access-Control-Allow-Origin'] === '*');
  expect('corsHeaders has Access-Control-Allow-Methods', headers['Access-Control-Allow-Methods'] === 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  expect('corsHeaders has Access-Control-Allow-Headers', headers['Access-Control-Allow-Headers'] === '*');
  expect('corsHeaders has Access-Control-Max-Age', headers['Access-Control-Max-Age'] === '86400');
} catch (e) {
  expect('corsHeaders test threw an exception', false, e.message);
}

console.log(`\nPassed: ${pass}  Failed: ${fail}`);
process.exit(fail ? 1 : 0);
