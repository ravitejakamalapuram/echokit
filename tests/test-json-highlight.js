import assert from 'node:assert/strict';
import { isValidJSON } from '../extension/shared/json-highlight.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

console.log('\nisValidJSON');

test('returns true for null', () => {
  assert.equal(isValidJSON(null), true);
});

test('returns true for undefined', () => {
  assert.equal(isValidJSON(undefined), true);
});

test('returns true for empty string', () => {
  assert.equal(isValidJSON(''), true);
});

test('returns true for whitespace-only string', () => {
  assert.equal(isValidJSON('   \n  \t  '), true);
});

test('returns true for valid JSON object', () => {
  assert.equal(isValidJSON('{"key": "value"}'), true);
});

test('returns true for valid JSON array', () => {
  assert.equal(isValidJSON('[1, 2, "three", null]'), true);
});

test('returns true for valid JSON boolean', () => {
  assert.equal(isValidJSON('true'), true);
  assert.equal(isValidJSON('false'), true);
});

test('returns true for valid JSON number', () => {
  assert.equal(isValidJSON('123'), true);
  assert.equal(isValidJSON('-45.67'), true);
});

test('returns true for valid JSON string', () => {
  assert.equal(isValidJSON('"hello"'), true);
});

test('returns false for unquoted strings', () => {
  assert.equal(isValidJSON('hello'), false);
});

test('returns false for object with unquoted keys', () => {
  assert.equal(isValidJSON('{key: "value"}'), false);
});

test('returns false for object with trailing comma', () => {
  assert.equal(isValidJSON('{"key": "value",}'), false);
});

test('returns false for malformed JSON', () => {
  assert.equal(isValidJSON('{"key": "value"'), false);
  assert.equal(isValidJSON('[1, 2, 3'), false);
  assert.equal(isValidJSON('{"key": '), false);
});

console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`);
console.log('─'.repeat(50));

if (failed > 0) {
  process.exit(1);
}
