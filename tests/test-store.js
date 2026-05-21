import assert from 'assert';

// Custom test runner code
let passed = 0;
let failed = 0;
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// ── Mock IndexedDB Environment ───────────────────────────────────────────────

const mockData = {
  interactions: new Map(),
  meta: new Map()
};

global.self = {
  indexedDB: {
    open: (name, version) => {
      const req = {};
      setTimeout(() => {
        const db = {
          objectStoreNames: {
            contains: (name) => false
          },
          createObjectStore: (name, options) => {
            return {
              createIndex: () => {}
            };
          },
          transaction: (storeName, mode) => {
            return {
              objectStore: (name) => {
                const storeData = mockData[name];
                return {
                  get: (id) => {
                    const r = {};
                    setTimeout(() => {
                      r.result = storeData.get(id);
                      if (r.onsuccess) r.onsuccess();
                    }, 0);
                    return r;
                  },
                  put: (item) => {
                    const r = {};
                    setTimeout(() => {
                      let key;
                      if (name === 'interactions') key = item.id;
                      if (name === 'meta') key = item.key;
                      storeData.set(key, item);
                      r.result = key;
                      if (r.onsuccess) r.onsuccess();
                    }, 0);
                    return r;
                  },
                  delete: (id) => {
                    const r = {};
                    setTimeout(() => {
                      storeData.delete(id);
                      r.result = undefined;
                      if (r.onsuccess) r.onsuccess();
                    }, 0);
                    return r;
                  },
                  getAll: () => {
                    const r = {};
                    setTimeout(() => {
                      r.result = Array.from(storeData.values());
                      if (r.onsuccess) r.onsuccess();
                    }, 0);
                    return r;
                  },
                  clear: () => {
                    const r = {};
                    setTimeout(() => {
                      storeData.clear();
                      r.result = undefined;
                      if (r.onsuccess) r.onsuccess();
                    }, 0);
                    return r;
                  },
                  index: (indexName) => {
                    return {
                      getAll: (query) => {
                        const r = {};
                        setTimeout(() => {
                          r.result = Array.from(storeData.values()).filter(v => v[indexName] === query);
                          if (r.onsuccess) r.onsuccess();
                        }, 0);
                        return r;
                      },
                      getAllKeys: (query) => {
                        const r = {};
                        setTimeout(() => {
                          const keys = [];
                          for (const [k, v] of storeData.entries()) {
                            if (v[indexName] === query) keys.push(k);
                          }
                          r.result = keys;
                          if (r.onsuccess) r.onsuccess();
                        }, 0);
                        return r;
                      }
                    };
                  }
                };
              }
            };
          }
        };
        req.result = db;
        if (req.onupgradeneeded) {
          req.onupgradeneeded();
        }
        if (req.onsuccess) {
          req.onsuccess();
        }
      }, 0);
      return req;
    }
  }
};

// Import module after mock is set up
const storeLib = await import('../extension/shared/store.js');

// ── Tests ───────────────────────────────────────────────────────────────────

console.log('\ngetInteraction');

test('returns existing interaction by id', async () => {
  const item = { id: 'test-1', method: 'GET', url: 'https://example.com' };
  mockData.interactions.set('test-1', item);

  const fetched = await storeLib.getInteraction('test-1');
  assert.deepEqual(fetched, item);
});

test('returns undefined for non-existent interaction', async () => {
  const fetched = await storeLib.getInteraction('missing-id');
  assert.strictEqual(fetched, undefined);
});

test('roundtrips correctly with putInteraction', async () => {
  const item = { id: 'test-2', method: 'POST', url: 'https://api.example.com' };

  await storeLib.putInteraction(item);
  const fetched = await storeLib.getInteraction('test-2');

  assert.deepEqual(fetched, item);
});

// Run tests
async function run() {
  for (const { name, fn } of tests) {
    try {
      mockData.interactions.clear();
      mockData.meta.clear();
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.stack || e.message}`);
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`);
  console.log('─'.repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

run();
