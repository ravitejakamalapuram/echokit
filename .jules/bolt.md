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
## 2026-07-14 - O(N) Object Allocation and Stringification in Render Loops
**Learning:** Filtering arrays in frequent update loops (e.g., \`filteredInteractions\`) by allocating new arrays inside \`Object.entries\` and repeatedly calling \`JSON.stringify\` inside \`searchBodyContent\` causes severe GC pressure and O(N) performance bottlenecks.
**Action:** Cache stringified object representations using a \`WeakMap\` for \`searchBodyContent\` and replace \`Object.entries\` with safe \`for...in\` loops to eliminate allocations and redundant processing during loops.
## 2025-02-18 - Math.max(...array) Call Stack Exhaustion and Performance Degradation
**Learning:** Using spread syntax with `Math.max(...rows.map(...))` or `Math.min(...rows.map(...))` on large datasets in rendering and calculation loops (like `calculateTimelineScale`) can cause a `Maximum call stack size exceeded` error due to engine argument limits. It also hurts performance by allocating intermediate mapped arrays and spreading them.
**Action:** Replace `Math.max(...map())` and `Math.min(...map())` with explicit single-pass `for` or `for...of` loops to compute minimum and maximum values without risking stack overflow or redundant array allocations.
## 2024-05-18 - Prevent redundant list filtering in render loop
**Learning:** In the EchoKit UI codebase, rendering components can cause redundant O(N) array filtering. Invoking \`filteredInteractions()\` multiple times in nested components within the same render loop creates unnecessary CPU load.
**Action:** Always pass pre-computed arrays (like the result of \`filteredInteractions()\`) down to components (e.g., \`renderInteractionListNew(list)\`) to avoid re-evaluating expensive filter chains on every render frame.
