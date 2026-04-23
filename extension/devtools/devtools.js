// Registers the EchoKit panel in Chrome DevTools.
chrome.devtools.panels.create(
  'EchoKit',
  'icons/icon48.png',
  'devtools/panel.html',
  () => {}
);
