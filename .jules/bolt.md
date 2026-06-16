## 2025-02-17 - O(N²) Performance Bottleneck in Conflict Resolution
**Learning:** Filtering arrays during rendering by `.filter(x => x.hash === i.hash).length` to count conflicts within mapping loops such as `renderRow` creates an O(N²) performance bottleneck, slowing down UI rendering.
**Action:** Use a `WeakMap` cached mechanism to pre-compute counts using a `Map` the first time an array is passed, then return counts from the cache to achieve O(N) performance overall and O(1) inside loops.
## 2025-02-18 - Syntax Error from Incomplete Refactor
**Learning:** When using diff-based modifications, failing to include corresponding closing blocks (like a `catch` block that matches a `try`) causes syntax errors. Modifying structural blocks requires modifying the whole block or removing orphaned pieces.
**Action:** Always verify syntax using `node -c <file>` or `pnpm lint` and pay strict attention to structural integrity when making string replacements or diffs.
