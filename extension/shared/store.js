// EchoKit — IndexedDB wrapper used exclusively from the background service worker.
// Stores recorded API interactions + global settings.

const DB_NAME = 'echokit';
const DB_VERSION = 1;
const STORE_INTERACTIONS = 'interactions';
const STORE_META = 'meta';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_INTERACTIONS)) {
        const os = db.createObjectStore(STORE_INTERACTIONS, { keyPath: 'id' });
        os.createIndex('hash', 'hash', { unique: false });
        os.createIndex('tabId', 'tabId', { unique: false });
        os.createIndex('sessionId', 'sessionId', { unique: false });
        os.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let _dbPromise = null;
function db() {
  if (!_dbPromise) _dbPromise = openDB();
  return _dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return db().then(d => d.transaction(storeName, mode).objectStore(storeName));
}

function req2promise(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function putInteraction(i) {
  const store = await tx(STORE_INTERACTIONS, 'readwrite');
  return req2promise(store.put(i));
}

export async function getInteraction(id) {
  const store = await tx(STORE_INTERACTIONS);
  return req2promise(store.get(id));
}

export async function deleteInteraction(id) {
  const store = await tx(STORE_INTERACTIONS, 'readwrite');
  return req2promise(store.delete(id));
}

export async function getAllInteractions() {
  const store = await tx(STORE_INTERACTIONS);
  return req2promise(store.getAll());
}

export async function getInteractionsByHash(hash) {
  const store = await tx(STORE_INTERACTIONS);
  const idx = store.index('hash');
  return req2promise(idx.getAll(hash));
}

export async function clearSessionInteractions(sessionId) {
  const store = await tx(STORE_INTERACTIONS, 'readwrite');
  const idx = store.index('sessionId');
  const keys = await req2promise(idx.getAllKeys(sessionId));
  await Promise.all(keys.map(k => req2promise(store.delete(k))));
  return keys.length;
}

export async function clearAllInteractions() {
  const store = await tx(STORE_INTERACTIONS, 'readwrite');
  return req2promise(store.clear());
}

export async function getMeta(key, fallback = null) {
  const store = await tx(STORE_META);
  const row = await req2promise(store.get(key));
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  const store = await tx(STORE_META, 'readwrite');
  return req2promise(store.put({ key, value }));
}

export default {
  putInteraction,
  getInteraction,
  deleteInteraction,
  getAllInteractions,
  getInteractionsByHash,
  clearSessionInteractions,
  clearAllInteractions,
  getMeta,
  setMeta
};
