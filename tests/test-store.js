import 'fake-indexeddb/auto';

// Mock self.indexedDB for the store since it runs in a browser worker context usually
global.self = { indexedDB: global.indexedDB };

const store = await import('../extension/shared/store.js');
const { getInteraction, putInteraction, deleteInteraction, clearAllInteractions } = store.default || store;

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`✅ ${name}`);
    passed++;
  }).catch(e => {
    console.error(`❌ ${name}`);
    console.error(`   ${e.stack}`);
    failed++;
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runTests() {
  console.log('Running store tests...\n');

  await test('getInteraction works for existing item', async () => {
    await clearAllInteractions();
    await putInteraction({ id: 'get-test-1', data: 'hello' });
    const item = await getInteraction('get-test-1');
    assert(item !== undefined, 'Item should exist');
    assert(item.id === 'get-test-1', 'Item should have correct id');
    assert(item.data === 'hello', 'Item should have correct data');
  });

  await test('getInteraction returns undefined for missing item', async () => {
    await clearAllInteractions();
    const item = await getInteraction('missing-id');
    assert(item === undefined, 'Missing item should be undefined');
  });

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
