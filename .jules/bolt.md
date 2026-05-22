## 2025-02-14 - List rendering complexity
**Learning:** Calling `.filter().length` on a large array inside a mapping function `renderRow` creates an O(N²) anti-pattern that slows down UI rendering significantly, especially when interactions array is large.
**Action:** Precompute counts using a `Map` in an O(N) pass before the mapping step, turning the rendering pass into O(1) lookups, saving significant compute time on large state updates.
