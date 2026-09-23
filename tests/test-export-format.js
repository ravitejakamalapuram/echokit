// Unit tests for the mock-set export envelope (extension/shared/export-format.js)
// and that consumers tolerate its `_generator` metadata field.
// Run with: node tests/test-export-format.js
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { buildMockExport, EXPORT_GENERATOR, EXPORT_VERSION } from '../extension/shared/export-format.js';

const require = createRequire(import.meta.url);
const { loadInteractions } = require('../cli/lib/server.js');

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

const sample = [
  { id: 'int_1', hash: 'h1', method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1', responseStatus: 200, responseBody: '{"id":1}' },
  { id: 'int_2', hash: 'h2', method: 'GET', url: 'https://jsonplaceholder.typicode.com/users/1', responseStatus: 200, responseBody: '{"id":1}' }
];

console.log('Running export-format tests...\n');

await test('export carries _generator, version 2, exportedAt and interactions', async () => {
  const now = new Date('2026-09-23T00:00:00Z');
  const out = buildMockExport(sample, now);
  assert.strictEqual(out._generator, 'EchoKit — https://echokit.dev');
  assert.strictEqual(out._generator, EXPORT_GENERATOR);
  assert.strictEqual(out.version, 2);
  assert.strictEqual(EXPORT_VERSION, 2);
  assert.strictEqual(out.exportedAt, '2026-09-23T00:00:00.000Z');
  assert.deepStrictEqual(out.interactions, sample);
});

await test('non-array interactions become an empty list', async () => {
  assert.deepStrictEqual(buildMockExport(undefined).interactions, []);
});

await test('echokit-server CLI loads an export with _generator unchanged', async () => {
  const file = path.join(os.tmpdir(), `echokit-export-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(buildMockExport(sample), null, 2));
  try {
    const loaded = await loadInteractions(file);
    assert.strictEqual(loaded.length, 2);
    assert.deepStrictEqual(loaded.map(i => i.id), ['int_1', 'int_2']);
  } finally {
    fs.unlinkSync(file);
  }
});

await test('extension importer contract: only `interactions` is read', async () => {
  // background.js handleEchokitImport requires Array.isArray(data.interactions)
  // and reads nothing else from the envelope; round-tripping through JSON keeps that true.
  const data = JSON.parse(JSON.stringify(buildMockExport(sample)));
  assert.ok(Array.isArray(data.interactions));
  assert.ok(data.interactions.every(it => it.id && it.hash));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
