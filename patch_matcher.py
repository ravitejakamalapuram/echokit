import re
with open('extension/shared/matcher.js', 'r') as f:
    content = f.read()

old_func = """export function computeMatchKeys(method, url, body) {
  const M = String(method || 'GET').toUpperCase();
  const full = `${M}|${normalizeUrl(url)}|${normalizeBody(body)}`;
  const noQuery = `${M}|${stripQuery(url)}|${normalizeBody(body)}`;
  const noBody = `${M}|${normalizeUrl(url)}|`;
  const pathOnly = `${M}|${stripQuery(url)}|`;"""

new_func = """export function computeMatchKeys(method, url, body) {
  const M = String(method || 'GET').toUpperCase();
  const normUrl = normalizeUrl(url);
  const normBody = normalizeBody(body);
  const strQuery = stripQuery(url);

  const full = `${M}|${normUrl}|${normBody}`;
  const noQuery = `${M}|${strQuery}|${normBody}`;
  const noBody = `${M}|${normUrl}|`;
  const pathOnly = `${M}|${strQuery}|`;"""

if old_func in content:
    content = content.replace(old_func, new_func)
    with open('extension/shared/matcher.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched extension/shared/matcher.js successfully.")
else:
    print("Could not find the target string in extension/shared/matcher.js.")
