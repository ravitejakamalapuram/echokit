/**
 * Unit tests for validation module.
 * 
 * Run with: node tests/test_validation.js
 */

import { validateSettings, validateUrlPattern } from '../extension/shared/validation.js';

// Simple test framework
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ ${name}`);
    console.error(`   ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test suite
console.log('Running validation tests...\n');

// Valid settings tests
test('validateSettings accepts valid boolean settings', () => {
  const result = validateSettings({ corsOverride: true, autoOpenOnRefresh: false });
  assert(result.valid === true, 'Should be valid');
  assert(result.errors.length === 0, 'Should have no errors');
});

test('validateSettings accepts valid scope', () => {
  const result = validateSettings({ scope: 'tab' });
  assert(result.valid === true, 'Should be valid');
});

test('validateSettings accepts valid theme', () => {
  const result = validateSettings({ theme: 'dark' });
  assert(result.valid === true, 'Should be valid');
});

test('validateSettings accepts valid blocklist array', () => {
  const result = validateSettings({
    blocklist: [
      { pattern: '*.example.com', enabled: true },
      { pattern: 'https://test.com/*', enabled: false }
    ]
  });
  assert(result.valid === true, 'Should be valid');
});

test('validateSettings accepts valid requestHeaders array', () => {
  const result = validateSettings({
    requestHeaders: [
      { key: 'Authorization', value: 'Bearer token', mode: 'override', urlPattern: '', enabled: true },
      { key: 'X-Custom', value: 'test', mode: 'append', urlPattern: '*.api.com', enabled: true }
    ]
  });
  assert(result.valid === true, 'Should be valid');
});

// Invalid settings tests
test('validateSettings rejects invalid key', () => {
  const result = validateSettings({ invalidKey: 'test' });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.length > 0, 'Should have errors');
  assert(result.errors[0].includes('invalidKey'), 'Error should mention invalid key');
});

test('validateSettings rejects invalid scope value', () => {
  const result = validateSettings({ scope: 'invalid' });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('scope')), 'Error should mention scope');
});

test('validateSettings rejects invalid theme value', () => {
  const result = validateSettings({ theme: 'invalid' });
  assert(result.valid === false, 'Should be invalid');
});

test('validateSettings rejects invalid type for corsOverride', () => {
  const result = validateSettings({ corsOverride: 'true' });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('boolean')), 'Error should mention boolean');
});

test('validateSettings rejects non-array blocklist', () => {
  const result = validateSettings({ blocklist: 'not-an-array' });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('array')), 'Error should mention array');
});

test('validateSettings rejects blocklist with invalid item', () => {
  const result = validateSettings({ blocklist: [{}] });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('pattern')), 'Error should mention pattern');
});

test('validateSettings rejects requestHeaders with invalid mode', () => {
  const result = validateSettings({
    requestHeaders: [{ key: 'X-Test', value: 'test', mode: 'invalid-mode' }]
  });
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('mode')), 'Error should mention mode');
});

test('validateSettings rejects non-object patch', () => {
  const result = validateSettings('not-an-object');
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors[0].includes('object'), 'Error should mention object');
});

test('validateSettings rejects array patch', () => {
  const result = validateSettings([]);
  assert(result.valid === false, 'Should be invalid');
});

test('validateSettings rejects null patch', () => {
  const result = validateSettings(null);
  assert(result.valid === false, 'Should be invalid');
});

// URL pattern validation tests
test('validateUrlPattern accepts valid URL pattern', () => {
  const result = validateUrlPattern('https://example.com/*');
  assert(result.valid === true, 'Should be valid');
  assert(result.error === null, 'Should have no error');
});

test('validateUrlPattern accepts empty pattern', () => {
  const result = validateUrlPattern('');
  assert(result.valid === true, 'Should be valid');
});

test('validateUrlPattern rejects non-string', () => {
  const result = validateUrlPattern(123);
  assert(result.valid === false, 'Should be invalid');
  assert(result.error !== null, 'Should have error');
});

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests passed: ${passed}`);
console.log(`Tests failed: ${failed}`);
console.log(`Total: ${passed + failed}`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
