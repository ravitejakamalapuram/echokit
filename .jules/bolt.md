## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.

## 2026-06-20 - O(N) URL Instantiation Bottleneck
**Learning:** `new URL()` allocations inside rendering loops (like `renderRow`, group functions) caused severe UI performance bottlenecks because native URL parsing is computationally expensive.
**Action:** Created and used `parseUrl` with a module-level LRU-like Map cache to cache URLs, drastically speeding up URL operations and preventing redundant O(N) allocations across renders.

## 2026-06-20 - O(N) URL Instantiation Bottleneck in background
**Learning:** `new URL().host` allocations inside array filters (like `visibleInContext` during mapping loops or `buildMockIndexFor` logic) caused severe performance bottlenecks because native URL parsing is computationally expensive.
**Action:** Added a `Map`-based LRU-like cache directly to the `hostOf` function in `background.js` to cache host resolution, drastically speeding up filtering operations and preventing redundant O(N) allocations on every UI refresh.

## 2025-02-18 - O(N) Performance Bottleneck from Redundant Function Calls in Render Loop
**Learning:** Calling `filteredInteractions()` multiple times within the rendering loop (e.g., inside `render()` and nested components like `renderFilterChips`) creates an O(N) performance bottleneck because it re-runs expensive filtering logic for every call unnecessarily.
**Action:** Pass pre-computed arrays or derived values (like `list.length`) down as arguments to child components instead of re-evaluating the expensive function at multiple levels in the component hierarchy.
## 2024-05-18 - Avoid repeated stringification and object allocations in filter loops
**Learning:** Filtering arrays in rendering loops (like filteredInteractions) that stringify JSON bodies repeatedly or use Object.entries on headers causes severe O(N) performance bottlenecks and massive garbage collection pauses.
**Action:** Utilize a WeakMap to cache stringified representations of immutable object bodies (JSON.stringify(body).toLowerCase()) and favor for...in loops over Object.entries() (with Object.prototype.hasOwnProperty.call check) to eliminate these bottlenecks.
## 2025-02-18 - O(N) Performance Bottleneck from Redundant Function Calls in Render Loop
**Learning:** Calling `filteredInteractions()` multiple times within the rendering loop (e.g., inside `render()` and nested components like `renderFilterChips` or `renderInteractionListNew`) creates an O(N) performance bottleneck because it re-runs expensive filtering logic for every call unnecessarily.
**Action:** Pass pre-computed arrays or derived values (like `list.length`) down as arguments to child components instead of re-evaluating the expensive function at multiple levels in the component hierarchy.
