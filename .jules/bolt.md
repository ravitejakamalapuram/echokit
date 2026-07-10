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
## 2024-07-10 - O(N) Performance Bottlenecks in Render Loops
**Learning:** Frequent rendering loops like \`filteredInteractions\` repeatedly stringify JSON bodies and allocate new arrays with \`Object.entries()\`, causing severe O(N) performance bottlenecks.
**Action:** Use a \`WeakMap\` to cache stringified representations of object bodies and favor \`for...in\` loops over \`Object.entries()\` inside frequent update loops to eliminate redundant allocations.
## 2025-03-01 - O(N) Filter Stringification and Array Allocation
**Learning:** During array filtering (e.g. `filteredInteractions`), calling `JSON.stringify(body)` and allocating arrays inside the loop using `Object.entries()` creates severe O(N) performance bottlenecks and memory pressure.
**Action:** Use a `WeakMap` to cache stringified representations of immutable objects (e.g., `bodyStringCache.set(body, str)`), and replace `Object.entries()` with `for...in` loops (with `hasOwnProperty` checks) to eliminate repeated overhead.
