import { getAllInteractions, deleteInteraction, putInteraction, clearAllInteractions } from './extension/shared/store.js';

// Setup IndexedDB in Node.js (dummy)
import { webcrypto } from 'crypto';
global.crypto = webcrypto;

// Since we can't easily mock IndexedDB completely in Node without heavy deps,
// let's create a benchmark script that runs IN the extension context using Puppeteer if possible,
// or we can just measure the store logic if we mock indexeddb properly.
