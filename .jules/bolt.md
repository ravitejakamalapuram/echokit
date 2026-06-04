## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.

## 2026-06-04 - Redundant Filter Optimizations
**Learning:** Multiple components calling `filteredInteractions()` creates redundant array iterations that hurt render performance.
**Action:** Pre-compute the filtered array at the top level of the render function and pass it down as an argument to child UI components.
