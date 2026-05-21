import assert from 'assert';

// Full fake indexedDB setup for tests
const FAKE_DB = {
  interactions: new Map(),
  meta: new Map()
};

const fakeIndexes = {
  interactions: {
    hash: new Map(),
    tabId: new Map(),
    sessionId: new Map(),
    timestamp: new Map()
  }
};

global.self = {
  indexedDB: {
    open: (name, version) => {
      const req = {};
      setTimeout(() => {
        const db = {
          objectStoreNames: {
            contains: (storeName) => true
          },
          transaction: (storeName, mode) => {
            return {
              objectStore: (name) => {
                const map = FAKE_DB[name];
                return {
                  get: (id) => {
                    const r = {};
                    setTimeout(() => {
                      r.result = map.get(id);
                      if (r.onsuccess) r.onsuccess({ target: r });
                    }, 0);
                    return r;
                  },
                  put: (item) => {
                     const r = {};
                     setTimeout(() => {
                        const key = name === 'interactions' ? item.id : item.key;
                        map.set(key, item);
                        r.result = key;
                        if (r.onsuccess) r.onsuccess({ target: r });
                     }, 0);
                     return r;
                  },
                  delete: (id) => {
                     const r = {};
                     setTimeout(() => {
                        map.delete(id);
                        r.result = undefined;
                        if (r.onsuccess) r.onsuccess({ target: r });
                     }, 0);
                     return r;
                  },
                  getAll: () => {
                     const r = {};
                     setTimeout(() => {
                        r.result = Array.from(map.values());
                        if (r.onsuccess) r.onsuccess({ target: r });
                     }, 0);
                     return r;
                  },
                  clear: () => {
                     const r = {};
                     setTimeout(() => {
                        map.clear();
                        r.result = undefined;
                        if (r.onsuccess) r.onsuccess({ target: r });
                     }, 0);
                     return r;
                  },
                  index: (idxName) => {
                     return {
                       getAll: (query) => {
                          const r = {};
                          setTimeout(() => {
                             // simplistic mock: just filter values
                             r.result = Array.from(map.values()).filter(v => v[idxName] === query);
                             if (r.onsuccess) r.onsuccess({ target: r });
                          }, 0);
                          return r;
                       },
                       getAllKeys: (query) => {
                          const r = {};
                          setTimeout(() => {
                             r.result = Array.from(map.values()).filter(v => v[idxName] === query).map(v => v.id);
                             if (r.onsuccess) r.onsuccess({ target: r });
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
        if (req.onsuccess) req.onsuccess({ target: req });
      }, 0);
      return req;
    }
  }
};

import * as store from '../extension/shared/store.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ ${name}`);
    console.error(`   ${e.stack}`);
    failed++;
  }
}

async function runTests() {
  console.log('Running store tests...\n');

  // Clear before starting
  await store.clearAllInteractions();

  await test('getInteraction returns existing item', async () => {
    const item = { id: '123', hash: 'abc', tabId: 1, sessionId: 's1', timestamp: 1000, data: 'test1' };
    await store.putInteraction(item);

    const fetched = await store.getInteraction('123');
    assert.deepEqual(fetched, item, 'Fetched item should match put item');
  });

  await test('getInteraction returns undefined for nonexistent item', async () => {
    const fetched = await store.getInteraction('nonexistent');
    assert.strictEqual(fetched, undefined, 'Fetching nonexistent item should return undefined');
  });

  await test('deleteInteraction removes item', async () => {
    const item = { id: 'del-123', hash: 'abc' };
    await store.putInteraction(item);
    await store.deleteInteraction('del-123');
    const fetched = await store.getInteraction('del-123');
    assert.strictEqual(fetched, undefined);
  });

  await test('getAllInteractions returns all items', async () => {
    await store.clearAllInteractions();
    await store.putInteraction({ id: 'i1', data: '1' });
    await store.putInteraction({ id: 'i2', data: '2' });
    const all = await store.getAllInteractions();
    assert.strictEqual(all.length, 2);
    assert.ok(all.some(i => i.id === 'i1'));
    assert.ok(all.some(i => i.id === 'i2'));
  });

  await test('getInteractionsByHash filters by hash', async () => {
    await store.clearAllInteractions();
    await store.putInteraction({ id: 'i1', hash: 'h1' });
    await store.putInteraction({ id: 'i2', hash: 'h2' });
    await store.putInteraction({ id: 'i3', hash: 'h1' });

    const byHash = await store.getInteractionsByHash('h1');
    assert.strictEqual(byHash.length, 2);
    assert.ok(byHash.some(i => i.id === 'i1'));
    assert.ok(byHash.some(i => i.id === 'i3'));
  });

  await test('clearSessionInteractions removes only items for session', async () => {
    await store.clearAllInteractions();
    await store.putInteraction({ id: 'i1', sessionId: 's1' });
    await store.putInteraction({ id: 'i2', sessionId: 's2' });
    await store.putInteraction({ id: 'i3', sessionId: 's1' });

    const count = await store.clearSessionInteractions('s1');
    assert.strictEqual(count, 2, 'Should have deleted 2 items');

    const all = await store.getAllInteractions();
    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0].id, 'i2', 'Only s2 items should remain');
  });

  await test('getMeta and setMeta work as expected', async () => {
    await store.setMeta('myKey', 'myValue');
    const val = await store.getMeta('myKey');
    assert.strictEqual(val, 'myValue');

    const fallback = await store.getMeta('missingKey', 'defaultVal');
    assert.strictEqual(fallback, 'defaultVal');
  });

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
