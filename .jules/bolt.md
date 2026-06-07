## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.

## 2025-02-18 - Repeated new URL() parsing in UI rendering loops is a massive performance bottleneck
**Learning:** Instantiating `new URL()` inside tight loops mapping over interactions during rendering (such as `domainOf` in `groupByDomain` and `prettyUrl` inside `renderInteractionRow` and `renderRow`) is a severe performance bottleneck, adding significant execution time to every render cycle.
**Action:** Implemented a single `Map`-based caching mechanism (`urlCache`) so parsed URLs are computed once per string and instantly returned in subsequent requests, reducing parsing time for repetitive URLs to O(1).
