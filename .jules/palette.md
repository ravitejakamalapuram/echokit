## 2025-02-18 - Clickable badge a11y issue
**Learning:** Using a `<span>` element with `role="button"` and `tabindex="0"` creates accessibility issues because `Enter` and `Space` key presses are not handled automatically by native click listeners, making it inaccessible for keyboard users.
**Action:** Use native semantic `<button>` elements instead when an element is interactive, combined with proper `:focus-visible` styling, to ensure keyboard accessibility works correctly out-of-the-box.

## 2026-06-17 - Filter chips missing context
**Learning:** Adding `aria-pressed` to interactive toggle chips helps screen readers communicate their state correctly, while adding `title` properties matching `aria-label` properties helps sighted users via tooltips, significantly improving the filter chips UX.
**Action:** Ensure dynamic filter chips have matching `title` and `aria-label` attributes to accommodate both mouse users and screen reader users respectively.
