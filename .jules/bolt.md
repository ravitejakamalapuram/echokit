## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.

## $(date +%Y-%m-%d) - O(N) Array Filtering Bottleneck in `render()`
**Learning:** Performing array filtering (`.filter()`) to find matching interactions on every render cycle creates an O(N) bottleneck, especially when the filtered items are just subsets grouped by a specific key like `hash`.
**Action:** Use a `WeakMap` cached mechanism to pre-compute and store grouped arrays instead of just counts. This turns the O(N) filter into an amortized O(1) cache lookup, improving rendering performance for dynamic UI updates.
