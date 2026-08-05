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

## 2024-07-16 - Accessible Dynamic Notifications
**Learning:** Dynamic DOM-injected toast notifications require `role="status"` and `aria-live="polite"` to be announced by screen readers without disrupting the user's flow.
**Action:** Always include these ARIA attributes when dynamically generating non-intrusive status messages in the UI.

## 2025-02-23 - Missing context on dialog Cancel buttons

**Learning:** Text-only buttons like "Cancel" in modal dialogs provide context through their text for screen readers, but adding explicit `title` attributes gives sighted mouse users immediate visual tooltips, and pairing it with an identical `aria-label` ensures full parity across all user interaction modes.
**Action:** Always provide explicit `title` and `aria-label` attributes for dialog action buttons to ensure parity between mouse users and screen reader users.

## 2025-02-23 - Explicit context for generic remove/close buttons

**Learning:** Generic icon-only buttons in lists (like `ek-kv-remove` or `ek-close`) must have explicit context in their `aria-label` and `title` attributes indicating exactly what item they act upon (e.g., 'remove chain step' instead of a generic 'remove') to ensure clarity for screen readers.
**Action:** Always provide explicit contextual `title` and `aria-label` attributes for list item removal or modal close buttons to avoid ambiguity for screen reader and sighted mouse users.

