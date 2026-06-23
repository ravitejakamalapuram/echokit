## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.
## 2026-06-20 - O(N) URL Instantiation Bottleneck
**Learning:** `new URL()` allocations inside rendering loops (like `renderRow`, group functions) caused severe UI performance bottlenecks because native URL parsing is computationally expensive.
**Action:** Created and used `parseUrl` with a module-level LRU-like Map cache to cache URLs, drastically speeding up URL operations and preventing redundant O(N) allocations across renders.
## 2025-02-18 - URL Object Instantiation Bottleneck in Background Scripts
**Learning:** Instantiating `new URL()` inside loops (such as array map/filter functions or during network request interception checks like `hostOf`) introduces a severe performance bottleneck due to expensive native URL parsing. This causes high CPU usage and blocking.
**Action:** Implemented a module-level LRU `Map` cache (`urlHostCache`) to store parsed hostnames against full URLs. This optimization avoids redundant `new URL()` allocations and provides O(1) retrieval time for frequently evaluated URLs.
