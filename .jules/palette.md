## 2025-02-18 - Clickable badge a11y issue
**Learning:** Using a `<span>` element with `role="button"` and `tabindex="0"` creates accessibility issues because `Enter` and `Space` key presses are not handled automatically by native click listeners, making it inaccessible for keyboard users.
**Action:** Use native semantic `<button>` elements instead when an element is interactive, combined with proper `:focus-visible` styling, to ensure keyboard accessibility works correctly out-of-the-box.
## 2024-06-01 - ARIA State Attributes for Dynamic UI Elements
**Learning:** Interactive components like toggle buttons and expandable sections need their ARIA attributes (`aria-pressed`, `aria-expanded`) to be dynamically linked to the application's state variables so that screen readers accurately reflect their current state as users interact with them.
**Action:** Always ensure that attributes like `aria-pressed` or `aria-expanded` contain ternary checks or string interpolations linked to the exact boolean or value used to visually render the component's active/open state.
