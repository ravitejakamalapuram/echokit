## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.
## 2025-02-18 - Cached URL parsing in tight loops
**Learning:** Instantiating new URL() objects inside rendering loops like renderInteractionRow or groupByDomain is a significant performance bottleneck (O(N)).
**Action:** Replaced inline `new URL()` calls with a module-level cached `parseUrl()` utility in `extension/shared/interaction-helpers.js` that returns parsed objects in O(1) time and has a protective MAX_CACHE_SIZE.
