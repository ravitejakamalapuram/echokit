## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.
## 2025-02-18 - Repeated new URL() In Render Loops
**Learning:** Instantiating `new URL()` inside tight loops during UI rendering (like `renderRow`, `groupByDomain`, and waterfall rendering) creates a significant performance bottleneck due to the O(N) cost of parsing and object allocation.
**Action:** Use an LRU-style Map cache (`urlCache`) within an exported `parseUrl` utility to store and retrieve parsed URLs in O(1) time, replacing inline `new URL()` calls in mapping and rendering functions.
