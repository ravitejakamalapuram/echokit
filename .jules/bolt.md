## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.
## 2025-02-17 - O(N) Performance Bottleneck in URL Parsing
**Learning:** Instantiating `new URL()` inside tight loops during UI rendering (like `renderRow`, `waterfall`, or `groupByDomain`) creates a severe performance bottleneck. Tests showed that parsing URLs repeatedly takes significantly longer than returning cached objects.
**Action:** Always use the `parseUrl` utility from `extension/shared/interaction-helpers.js`, which utilizes a module-level `Map` cache (`urlCache`) with a size limit to store and retrieve parsed URLs in O(1) time.
