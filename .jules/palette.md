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

## 2025-02-22 - Missing accessible scope on destructive actions
**Learning:** Destructive action buttons (like settings 'Wipe' or 'Delete this mock') in this app's UI lacked corresponding `title` and `aria-label` attributes to clarify their scope, which could lead to accidental data loss for screen reader and sighted mouse users.
**Action:** Always provide explicit `title` and `aria-label` attributes detailing the scope of the action for destructive buttons to ensure safe usability.

## 2025-02-22 - WCAG 2.5.3 (Label in Name) violation
**Learning:** Overriding a button's accessible name using `aria-label` with a descriptive string that omits the button's visual text violates WCAG 2.5.3 (Label in Name). This breaks voice dictation software, as users cannot activate the button by saying its visible text.
**Action:** Always ensure the visual text of an element is included within its `aria-label` (e.g., `<button aria-label="Wipe all recordings">Wipe</button>`), or use `aria-describedby` for additional context instead of overriding the label.
