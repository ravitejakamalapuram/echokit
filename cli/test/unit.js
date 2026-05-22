'use strict';

const { corsHeaders, delay } = require('../lib/server');

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

async function testDelay() {
  // Test 1: Positive delay
  const start1 = Date.now();
  await delay(100);
  const end1 = Date.now();
  const duration1 = end1 - start1;
  // We expect it to take at least ~90ms (allowing for slight timer inaccuracy)
  expect('delay(100) waits ~100ms', duration1 >= 90, `took ${duration1}ms`);

  // Test 2: Negative delay falls back to 0
  const start2 = Date.now();
  await delay(-50);
  const end2 = Date.now();
  const duration2 = end2 - start2;
  expect('delay(-50) falls back to 0', duration2 < 20, `took ${duration2}ms`);

  // Test 3: Non-numeric/string inputs handled by bitwise OR
  const start3 = Date.now();
  await delay('100');
  const end3 = Date.now();
  const duration3 = end3 - start3;
  expect("delay('100') parses string correctly", duration3 >= 90, `took ${duration3}ms`);

  const start4 = Date.now();
  await delay('invalid');
  const end4 = Date.now();
  const duration4 = end4 - start4;
  expect("delay('invalid') falls back to 0", duration4 < 20, `took ${duration4}ms`);
}

(async () => {
  console.log('--- Running Unit Tests ---');

  try {
    testCorsHeaders();
    await testDelay();
  } catch (e) {
    fail++;
    console.error('[FAIL] Exception during tests:', e.message);
  }

  console.log(`\nUnit Tests Passed: ${pass}  Failed: ${fail}`);
  if (fail > 0) {
    process.exit(1);
  }
})();
