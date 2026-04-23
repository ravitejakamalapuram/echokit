import { initEchoKitUI } from '../shared/app.js';

initEchoKitUI({
  mode: 'devtools',
  root: document.getElementById('ek-root'),
  tabId: chrome.devtools.inspectedWindow.tabId
});
