## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.

## 2025-02-18 - Multiple pass `.filter()` bottleneck
**Learning:** Chaining multiple `.filter()` calls sequentially on an array evaluates the array multiple times, creating multiple intermediate array allocations.
**Action:** Consolidate multiple `.filter()` conditions into a single pass and extract static query variables out of the loop.
