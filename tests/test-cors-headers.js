// Unit tests for the vendored CORS header semantics (extension/shared/cors-headers.js).
// Run with: node tests/test-cors-headers.js
import assert from 'assert';
import {
  buildCorsResponseHeaders,
  resolveOriginContext,
  ECHOKIT_DEFAULT_PROFILE
} from '../extension/shared/cors-headers.js';

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ ${name}`);
    console.error(`   ${e.message}`);
    failed++;
  }
}

console.log('Running cors-headers tests...\n');

await test('EchoKit default profile emits exactly the 3 "*" headers, in order', () => {
  const specs = buildCorsResponseHeaders(ECHOKIT_DEFAULT_PROFILE);
  assert.deepStrictEqual(specs, [
    { header: 'Access-Control-Allow-Origin', operation: 'set', value: '*' },
    { header: 'Access-Control-Allow-Methods', operation: 'set', value: '*' },
    { header: 'Access-Control-Allow-Headers', operation: 'set', value: '*' }
  ]);
});

await test('omitting the profile argument defaults to the EchoKit profile', () => {
  assert.deepStrictEqual(buildCorsResponseHeaders(), buildCorsResponseHeaders(ECHOKIT_DEFAULT_PROFILE));
});

await test('credentialed profile never emits "*" for origin, methods or headers', () => {
  const specs = buildCorsResponseHeaders({
    allowCredentials: true,
    allowedOrigins: ['https://app.example.com']
  });
  const byHeader = Object.fromEntries(specs.map(s => [s.header, s.value]));
  assert.strictEqual(byHeader['Access-Control-Allow-Origin'], 'https://app.example.com');
  assert.notStrictEqual(byHeader['Access-Control-Allow-Origin'], '*');
  assert.notStrictEqual(byHeader['Access-Control-Allow-Methods'], '*');
  assert.notStrictEqual(byHeader['Access-Control-Allow-Headers'], '*');
});

await test('credentialed profile emits Vary: Origin and Access-Control-Allow-Credentials: true', () => {
  const specs = buildCorsResponseHeaders({
    allowCredentials: true,
    allowedOrigins: ['https://app.example.com']
  });
  const byHeader = Object.fromEntries(specs.map(s => [s.header, s.value]));
  assert.strictEqual(byHeader['Vary'], 'Origin');
  assert.strictEqual(byHeader['Access-Control-Allow-Credentials'], 'true');
});

await test('resolveOriginContext: no credentials, no explicit origin -> wildcard', () => {
  assert.deepStrictEqual(resolveOriginContext(ECHOKIT_DEFAULT_PROFILE), {
    credentials: false,
    origin: '*',
    origins: []
  });
});

await test('resolveOriginContext: credentials with no allowedOrigins falls back to credentialedOrigin', () => {
  const ctx = resolveOriginContext({ allowCredentials: true, credentialedOrigin: 'https://app.example.com' });
  assert.strictEqual(ctx.credentials, true);
  assert.strictEqual(ctx.origin, 'https://app.example.com');
});

await test('exposeHeaders, maxAge and allowPrivateNetwork are opt-in and off by default', () => {
  const specs = buildCorsResponseHeaders(ECHOKIT_DEFAULT_PROFILE);
  const headers = specs.map(s => s.header);
  assert.ok(!headers.includes('Access-Control-Expose-Headers'));
  assert.ok(!headers.includes('Access-Control-Max-Age'));
  assert.ok(!headers.includes('Access-Control-Allow-Private-Network'));
});

await test('exposeHeaders, maxAge and allowPrivateNetwork appear when explicitly set', () => {
  const specs = buildCorsResponseHeaders({
    allowCredentials: false,
    allowedOrigins: [],
    exposeHeaders: ['X-Custom-Header'],
    maxAge: 600,
    allowPrivateNetwork: true
  });
  const byHeader = Object.fromEntries(specs.map(s => [s.header, s.value]));
  assert.strictEqual(byHeader['Access-Control-Expose-Headers'], 'X-Custom-Header');
  assert.strictEqual(byHeader['Access-Control-Max-Age'], '600');
  assert.strictEqual(byHeader['Access-Control-Allow-Private-Network'], 'true');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
