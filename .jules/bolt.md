## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.
## 2025-02-17 - O(1) URL Cache Optimization in Rendering Loops
**Learning:** Instantiating `new URL()` inside tight loops mapping over items during UI rendering (like `renderRow`, `domainOf`, or waterfall extraction) is a severe performance bottleneck because parsing the identical strings repeatedly consumes substantial CPU time.
**Action:** Implement a module-level `Map` cache (e.g., `urlCache` with `getCachedURL`) to store and retrieve parsed URLs in O(1) time instead of repeatedly calling `new URL()` inside mapping loops. Clear the cache when it grows too large to prevent memory leaks.
