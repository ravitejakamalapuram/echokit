## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.
## 2025-02-18 - URL Parsing Performance Bottleneck
**Learning:** Instantiating `new URL()` inside tight loops during UI rendering (like in `renderRow` or `groupByDomain`) is a severe performance bottleneck.
**Action:** Always use a `Map` cached `parseUrl(url, base)` utility with a max size to avoid redundant object creations and achieve O(1) parsing time during UI rendering.
## 2025-02-18 - URL Caching Memory Management
**Learning:** Returning cached `URL` objects provides a performance boost but exposes the app to subtle cache-corruption bugs in the future if consumers mutate the URL object, because `URL` instances are inherently mutable.
**Action:** When caching and reusing parsed `URL` objects, add a prominent warning comment telling developers not to mutate the returned URL object. If mutation is strictly necessary, safely clone the cached URL first.
