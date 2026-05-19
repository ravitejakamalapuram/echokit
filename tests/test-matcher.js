/**
 * EchoKit — matcher.js unit tests
 * Run: node tests/test-matcher.js
 * Zero dependencies — uses Node's built-in assert module.
 */

import assert from 'node:assert/strict';
import { normalizeUrl, stripQuery, normalizeBody, computeMatchKeys, computeHash, parseGraphQL } from '../extension/shared/matcher.js';

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

// ── normalizeUrl ────────────────────────────────────────────────────────────
console.log('\nnormalizeUrl');

test('returns url unchanged when no query params', () => {
  assert.equal(normalizeUrl('http://api.example.com/users'), 'http://api.example.com/users');
});

test('sorts query params alphabetically', () => {
  const result = normalizeUrl('http://api.example.com/search?z=1&a=2&m=3');
  assert.ok(result.includes('a=2'), 'a param present');
  const aIdx = result.indexOf('a=2');
  const mIdx = result.indexOf('m=3');
  const zIdx = result.indexOf('z=1');
  assert.ok(aIdx < mIdx && mIdx < zIdx, 'params sorted a < m < z');
});

test('sorts params with same key by value', () => {
  const result = normalizeUrl('http://example.com/?tag=z&tag=a');
  assert.ok(result.indexOf('tag=a') < result.indexOf('tag=z'), 'same-key params sorted by value');
});

test('strips hash fragment', () => {
  const result = normalizeUrl('http://example.com/page?x=1#section');
  assert.ok(!result.includes('#'), 'hash stripped');
  assert.ok(result.includes('x=1'), 'query preserved');
});

test('handles relative url with base', () => {
  const result = normalizeUrl('/api/users?z=1&a=2', 'http://example.com');
  assert.ok(result.includes('a=2'), 'a param present');
  assert.ok(result.startsWith('http://example.com'), 'base applied');
});

test('returns string unchanged on invalid url without base', () => {
  const result = normalizeUrl('not-a-url-at-all');
  assert.equal(typeof result, 'string');
});

test('encodes special characters in params', () => {
  const result = normalizeUrl('http://example.com/?q=hello world');
  assert.ok(result.includes('hello%20world') || result.includes('hello+world'), 'space encoded');
});

// ── stripQuery ───────────────────────────────────────────────────────────────
console.log('\nstripQuery');

test('removes query string', () => {
  const result = stripQuery('http://api.example.com/users?page=1&limit=10');
  assert.ok(!result.includes('?'), 'query removed');
  assert.ok(result.includes('/users'), 'path preserved');
});

test('removes hash', () => {
  const result = stripQuery('http://example.com/page#section');
  assert.ok(!result.includes('#'), 'hash removed');
});

test('leaves path-only url intact', () => {
  const result = stripQuery('http://example.com/api/v1/users');
  assert.equal(result, 'http://example.com/api/v1/users');
});

// ── normalizeBody ────────────────────────────────────────────────────────────
console.log('\nnormalizeBody');

test('returns empty string for null', () => {
  assert.equal(normalizeBody(null), '');
});

test('returns empty string for empty string', () => {
  assert.equal(normalizeBody(''), '');
});

test('stable-stringifies JSON — sorts keys', () => {
  const a = normalizeBody('{"z":1,"a":2,"m":3}');
  const b = normalizeBody('{"a":2,"m":3,"z":1}');
  assert.equal(a, b, 'different key order produces same output');
});

test('stable-stringifies JSON — nested objects', () => {
  const a = normalizeBody('{"user":{"name":"Alice","id":1}}');
  const b = normalizeBody('{"user":{"id":1,"name":"Alice"}}');
  assert.equal(a, b, 'nested key order normalised');
});

test('stable-stringifies JSON — arrays preserve order', () => {
  const a = normalizeBody('[1,2,3]');
  const b = normalizeBody('[3,2,1]');
  assert.notEqual(a, b, 'array order is NOT normalised (intentional)');
});

test('returns raw string for non-JSON string body', () => {
  const result = normalizeBody('plain text body');
  assert.equal(result, 'plain text body');
});

test('handles URLSearchParams', () => {
  const params = new URLSearchParams('z=1&a=2');
  const result = normalizeBody(params);
  assert.ok(typeof result === 'string' && result.length > 0, 'produces non-empty string');
  const sorted = JSON.parse(result);
  assert.equal(sorted[0][0], 'a', 'params sorted alphabetically');
});

test('handles ArrayBuffer', () => {
  const buf = new ArrayBuffer(16);
  const result = normalizeBody(buf);
  assert.match(result, /^\[ab:\d+\]$/, 'ArrayBuffer placeholder format');
});

test('handles plain object (non-JSON-string)', () => {
  const result = normalizeBody({ z: 1, a: 2 });
  assert.ok(result.includes('"a"'), 'keys present');
  const aIdx = result.indexOf('"a"');
  const zIdx = result.indexOf('"z"');
  assert.ok(aIdx < zIdx, 'keys sorted');
});

// ── computeHash ──────────────────────────────────────────────────────────────
console.log('\ncomputeHash');

test('same inputs produce same hash', () => {
  const h1 = computeHash('GET', 'http://api.example.com/users?b=2&a=1', '');
  const h2 = computeHash('GET', 'http://api.example.com/users?a=1&b=2', '');
  assert.equal(h1, h2, 'param order does not affect hash');
});

test('different methods produce different hashes', () => {
  const get = computeHash('GET', 'http://example.com/api', '');
  const post = computeHash('POST', 'http://example.com/api', '');
  assert.notEqual(get, post, 'GET ≠ POST');
});

test('different URLs produce different hashes', () => {
  const a = computeHash('GET', 'http://example.com/users', '');
  const b = computeHash('GET', 'http://example.com/posts', '');
  assert.notEqual(a, b, 'different paths produce different hashes');
});

test('different bodies produce different hashes', () => {
  const a = computeHash('POST', 'http://example.com/api', '{"id":1}');
  const b = computeHash('POST', 'http://example.com/api', '{"id":2}');
  assert.notEqual(a, b, 'different bodies produce different hashes');
});

test('method is case-insensitive', () => {
  const lower = computeHash('get', 'http://example.com/api', '');
  const upper = computeHash('GET', 'http://example.com/api', '');
  assert.equal(lower, upper, 'get === GET');
});

test('JSON body with reordered keys hashes identically', () => {
  const a = computeHash('POST', 'http://example.com/api', '{"z":1,"a":2}');
  const b = computeHash('POST', 'http://example.com/api', '{"a":2,"z":1}');
  assert.equal(a, b, 'JSON key order does not affect hash');
});

test('hash is a non-empty string', () => {
  const h = computeHash('GET', 'http://example.com/', '');
  assert.equal(typeof h, 'string');
  assert.ok(h.length > 0, 'non-empty');
});

// ── computeMatchKeys ─────────────────────────────────────────────────────────
console.log('\ncomputeMatchKeys');

test('returns all four base modes', () => {
  const keys = computeMatchKeys('GET', 'http://example.com/api?x=1', '{"a":1}');
  assert.ok('strict' in keys, 'strict present');
  assert.ok('ignore-query' in keys, 'ignore-query present');
  assert.ok('ignore-body' in keys, 'ignore-body present');
  assert.ok('path-wildcard' in keys, 'path-wildcard present');
});

test('strict differs from ignore-query when URL has params', () => {
  const keys = computeMatchKeys('GET', 'http://example.com/api?x=1', '');
  assert.notEqual(keys.strict, keys['ignore-query'], 'strict ≠ ignore-query with query params');
});

test('ignore-query matches different param sets', () => {
  const a = computeMatchKeys('GET', 'http://example.com/api?x=1', '');
  const b = computeMatchKeys('GET', 'http://example.com/api?y=2', '');
  assert.equal(a['ignore-query'], b['ignore-query'], 'different params → same ignore-query key');
});

test('adds graphql + graphql-op keys for GQL bodies', () => {
  const body = JSON.stringify({ query: 'query GetUser { user { id } }', variables: { id: 1 } });
  const keys = computeMatchKeys('POST', 'http://example.com/graphql', body);
  assert.ok('graphql' in keys, 'graphql key present');
  assert.ok('graphql-op' in keys, 'graphql-op key present');
});

test('graphql and graphql-op differ when variables present', () => {
  const body = JSON.stringify({ query: 'query GetUser { user { id } }', variables: { id: 1 } });
  const keys = computeMatchKeys('POST', 'http://example.com/graphql', body);
  assert.notEqual(keys.graphql, keys['graphql-op'], 'graphql ≠ graphql-op with variables');
});

test('no graphql keys for non-GQL bodies', () => {
  const keys = computeMatchKeys('POST', 'http://example.com/api', '{"data":"value"}');
  assert.ok(!('graphql' in keys), 'no graphql key for non-GQL');
});

// ── parseGraphQL ─────────────────────────────────────────────────────────────
console.log('\nparseGraphQL');

test('parses standard POST GQL body', () => {
  const body = JSON.stringify({ query: 'query GetUser { user { id name } }', variables: { id: 1 } });
  const result = parseGraphQL(body, 'http://example.com/graphql');
  assert.ok(result !== null, 'parsed');
  assert.ok(result.query.includes('GetUser'), 'query preserved');
  assert.deepEqual(result.variables, { id: 1 }, 'variables preserved');
});

test('extracts operation name', () => {
  const body = JSON.stringify({ query: 'query FetchPosts { posts { id } }' });
  const result = parseGraphQL(body, 'http://example.com/graphql');
  assert.equal(result.operationName, 'FetchPosts', 'operation name extracted');
});

test('normalises whitespace in query', () => {
  const body = JSON.stringify({ query: 'query   GetUser  {\n  user  {\n    id\n  }\n}' });
  const result = parseGraphQL(body, '');
  assert.ok(!result.query.includes('\n'), 'newlines removed');
  assert.ok(!result.query.includes('  '), 'double spaces removed');
});

test('returns null for non-GQL JSON', () => {
  const result = parseGraphQL('{"user":"alice"}', 'http://example.com/api');
  assert.equal(result, null, 'non-GQL returns null');
});

test('returns null for empty body', () => {
  assert.equal(parseGraphQL('', ''), null);
  assert.equal(parseGraphQL(null, ''), null);
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`);
console.log('─'.repeat(50));

if (failed > 0) {
  process.exit(1);
}
