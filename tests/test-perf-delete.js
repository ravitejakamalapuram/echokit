import "fake-indexeddb/auto";
import { getAllInteractions, putInteraction, deleteInteraction } from '../extension/shared/store.js';

// We need to write a custom store function to test the IDB transaction approach
const DB_NAME = 'echokit';
const DB_VERSION = 1;
const STORE_INTERACTIONS = 'interactions';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeName, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function req2promise(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function deleteInteractionsNative(ids) {
  if (ids.length === 0) return 0;
  const store = await tx(STORE_INTERACTIONS, 'readwrite');
  await Promise.all(ids.map(id => req2promise(store.delete(id))));
  return ids.length;
}

global.self = global;

async function runBenchmark(mode, numRecords = 500) {
  const NUM_RECORDS = numRecords;

  // 1. Seed database
  for (let i = 0; i < NUM_RECORDS; i++) {
    await putInteraction({ id: `int_${i}`, tabId: 1, host: 'example.com' });
  }

  const all = await getAllInteractions();

  // 2. Benchmark current implementation (N+1 awaits)
  let deleted = 0;
  const start = performance.now();

  if (mode === 'promiseAll') {
    const promises = [];
    for (const it of all) {
      promises.push(deleteInteraction(it.id));
      deleted++;
    }
    await Promise.all(promises);
  } else if (mode === 'bulk') {
    const ids = all.map(it => it.id);
    await deleteInteractionsNative(ids);
    deleted = ids.length;
  } else {
    for (const it of all) {
      await deleteInteraction(it.id);
      deleted++;
    }
  }

  const end = performance.now();
  console.log(`[N=${numRecords}] ${mode} - Deleted ${deleted} records in ${(end - start).toFixed(2)}ms`);
}

async function run() {
  for (const n of [100, 500, 1000]) {
    await runBenchmark('sequential', n);
    await runBenchmark('promiseAll', n);
    await runBenchmark('bulk', n);
    console.log('---');
  }
}
run().catch(console.error);
