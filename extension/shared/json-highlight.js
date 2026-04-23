// EchoKit — tiny JSON syntax highlighter.
// Returns HTML string with <span class="jh-..."> tokens. No dependencies.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ESC[c]);

export function highlightJSON(input) {
  if (input == null) return '';
  let text;
  try { text = JSON.stringify(JSON.parse(input), null, 2); }
  catch { return escapeHtml(String(input)); }
  return text.replace(
    /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (match, str, colon, kw) => {
      if (str) {
        const cls = colon ? 'jh-key' : 'jh-string';
        return `<span class="${cls}">${escapeHtml(str)}</span>${colon || ''}`;
      }
      if (kw) return `<span class="jh-kw">${kw}</span>`;
      return `<span class="jh-num">${match}</span>`;
    }
  );
}

export function isValidJSON(s) {
  if (!s || !s.trim()) return true;
  try { JSON.parse(s); return true; } catch { return false; }
}
