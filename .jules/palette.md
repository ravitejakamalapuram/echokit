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
## 2026-07-29 - Missing ARIA labels on advanced filter inputs
**Learning:** In the `extension/shared/app.js` UI, `<input>` elements used for filtering APIs (e.g., body content and headers) lacked explicit accessibility labels (`aria-label` or `title`), making them inaccessible for screen-reader users relying on generic placeholder texts.
**Action:** Always verify that all input fields, especially those without explicitly associated `<label>` tags (such as text inputs used in advanced filters or search bars), have clear `aria-label` and `title` attributes providing context on their purpose.
