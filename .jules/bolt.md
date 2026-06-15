## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.

## $(date +%Y-%m-%d) - URL Parsing Bottleneck in Render Loops
**Learning:** Instantiating `new URL()` inside tight rendering loops (e.g., mapping interactions or grouping by domain) throws repeated exceptions for invalid or relative URLs without a base, creating a severe rendering performance bottleneck.
**Action:** Implement an O(1) `Map`-backed caching utility (`parseUrl`) that catches exceptions once and reuses the parsed object. Never mutate the returned cached `URL` instance.
