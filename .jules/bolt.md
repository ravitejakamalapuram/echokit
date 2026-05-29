## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.

## 2025-02-17 - O(N * M) Performance Bottleneck in Chained Array Filters
**Learning:** Chaining multiple `.filter()` calls together (like filtering by methods, then status codes, then search queries) creates an O(N * M) performance bottleneck because each filter pass iterates over the intermediate arrays, causing multiple allocations and passes.
**Action:** Combine multiple array filter conditions into a single pass using a single `.filter(i => { ... })` call with early returns to skip further checks for rejected items. This reduces memory allocation and ensures O(N) filtering performance during critical UI rendering paths.
