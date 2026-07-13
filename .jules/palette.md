## 2025-02-18 - Clickable badge a11y issue
**Learning:** Using a `<span>` element with `role="button"` and `tabindex="0"` creates accessibility issues because `Enter` and `Space` key presses are not handled automatically by native click listeners, making it inaccessible for keyboard users.
**Action:** Use native semantic `<button>` elements instead when an element is interactive, combined with proper `:focus-visible` styling, to ensure keyboard accessibility works correctly out-of-the-box.

## 2025-02-18 - Missing hover tooltips on icon buttons
**Learning:** Icon-only buttons (like ✕) and dynamic filter chips in this app's UI used aria-labels for screen readers but lacked corresponding `title` attributes, meaning sighted mouse users had no tooltips to explain their function.
**Action:** Always pair `aria-label` with an identical `title` attribute on icon-only interactive elements to provide visual tooltips on hover.

## 2025-02-18 - Missing hover tooltips on interactive elements
**Learning:** Icon-only buttons (like settings and menu) and dynamic elements like toggle chips in this app's UI used `aria-label` for screen readers but lacked corresponding `title` attributes, or their `title` and `aria-label` values did not match, causing inconsistent experiences between sighted mouse users and screen reader users.
**Action:** Always pair `aria-label` with an identical `title` attribute on interactive elements to provide visual tooltips on hover that match screen reader announcements.

## 2025-02-22 - Missing tooltips on filter toolbar buttons
**Learning:** The "Advanced Filters" toggle and "Clear All" filter buttons in this app's UI lacked corresponding `title` and `aria-label` attributes, meaning sighted mouse users had no visual explanation of their function, and the "Clear All" button lacked context for screen readers.
**Action:** Always provide explicit `title` and `aria-label` attributes for utility buttons (especially those that toggle UI state or reset data) to ensure parity between mouse users and screen reader users.

## 2025-02-22 - Missing ARIA attributes on toast notifications
**Learning:** The custom `toast()` notification UI used to display brief feedback messages to the user lacked `role="status"` and `aria-live="polite"` attributes, meaning screen reader users would not be aware of these important success/error updates.
**Action:** Always add `role="status"` and `aria-live="polite"` (or `assertive` for critical errors) to dynamic toast notifications to ensure they are announced to screen readers.
