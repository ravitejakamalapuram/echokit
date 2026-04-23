# Screenshot guide — EchoKit

Chrome Web Store wants **1280×800 PNGs** (or 640×400). Five screenshots is the max and they're what sells the listing. Aim for these five:

### Recipe

1. **The record → mock loop (hero shot)** — DevTools panel open, showing 4–5 recorded API calls, one expanded with an edited JSON body. The **MOCKING ACTIVE** amber banner visible at the top.
2. **Strict matching in action** — two versions of the same `POST /api/login` with different bodies, side-by-side detail view showing their hashes. The conflict badge visible on the row.
3. **Error + latency simulation** — detail view with latency slider at `2500ms` and error mode set to `5xx`. The annotated effect ("your UI's spinner will show for 2.5s, then a 500").
4. **Domain grouping + filters** — list view with multiple domains (e.g., `api.stripe.com`, `localhost:3000`), method chips active, searching `"users"`.
5. **Keyboard shortcuts + themes** — shortcut modal + split view showing dark vs light themes (you can composite two screenshots side-by-side in Figma / Pixelmator for this).

### Stage your browser

- Use the **EchoKit demo page** (see `store/demo-page.html`) which makes a predictable set of 8 API calls — great for reproducible screenshots.
- Set your Chrome window to exactly **1280 × 800** via DevTools Device Toolbar.
- Use a clean Chrome profile (no other extensions in the toolbar).
- Turn on Chrome's Light theme for the 5th shot.
- Annotate with bold typography + arrow callouts in Figma. Keep marketing copy concise (6–10 words max).

### Naming

```
store/screenshots/
  01-record-mock-loop.png
  02-strict-matching.png
  03-latency-errors.png
  04-domain-grouping.png
  05-shortcuts-themes.png
```
