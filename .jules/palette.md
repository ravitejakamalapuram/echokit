## 2025-02-18 - Clickable badge a11y issue
**Learning:** Using a `<span>` element with `role="button"` and `tabindex="0"` creates accessibility issues because `Enter` and `Space` key presses are not handled automatically by native click listeners, making it inaccessible for keyboard users.
**Action:** Use native semantic `<button>` elements instead when an element is interactive, combined with proper `:focus-visible` styling, to ensure keyboard accessibility works correctly out-of-the-box.

## 2026-06-19 - Interactive chip a11y
**Learning:** Interactive filter chips used in a toolbar need to have native button properties (`type="button"`), an explicit `aria-label`, a corresponding `title` for hover, and a dynamic `aria-pressed` attribute for screen readers to properly announce their toggle state.
**Action:** When implementing toggle chips, ensure they are `<button>`s and dynamically map the `aria-pressed` property to their active state.
