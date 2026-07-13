import { computeMatchKeys } from './extension/shared/matcher.js';
import { performance } from 'perf_hooks';

const start = performance.now();
for (let i = 0; i < 10000; i++) {
  computeMatchKeys('GET', 'http://example.com/api/v1/users?limit=10&offset=20', '{"data": "test", "more": [1,2,3]}');
}
const end = performance.now();
console.log(`Time taken: ${(end - start).toFixed(2)} ms`);
