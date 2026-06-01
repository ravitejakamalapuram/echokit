## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.

## 2025-02-17 - O(K*N) Performance Bottleneck in Sequential Filtering
**Learning:** Chaining multiple `.filter()` methods dynamically creates intermediate arrays for every method called, introducing an O(K*N) performance overhead and memory allocation cost.
**Action:** Refactor sequentially chained filtering into a single-pass O(N) loop containing combined logic utilizing early returns to avoid intermediary garbage collection overhead.
