## 2025-02-18 - Clickable badge a11y issue
**Learning:** Using a `<span>` element with `role="button"` and `tabindex="0"` creates accessibility issues because `Enter` and `Space` key presses are not handled automatically by native click listeners, making it inaccessible for keyboard users.
**Action:** Use native semantic `<button>` elements instead when an element is interactive, combined with proper `:focus-visible` styling, to ensure keyboard accessibility works correctly out-of-the-box.

## 2025-02-19 - Filter Chips Keyboard Accessibility
**Learning:** Interactive tags or chips should use semantic `<button>` tags (with `type="button"` to prevent form submission side-effects). This automatically provides keyboard support and focusability which `<span>` elements lack, even if styled like buttons.
**Action:** When adding clickable tags/chips (like filter chips), always use `<button type="button">`, provide a descriptive `aria-label`, and ensure there is clear `:focus-visible` styling.
