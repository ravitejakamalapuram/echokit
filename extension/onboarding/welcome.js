// EchoKit — onboarding welcome page behaviour.
// Lives in its own file because the extension-page CSP (script-src 'self')
// blocks inline <script> blocks.

const DEMO_URL = 'https://jsonplaceholder.typicode.com/';

document.querySelector('[data-a="pin"]')?.addEventListener('click', () => {
  alert('To pin EchoKit: click the puzzle icon on the Chrome toolbar, find EchoKit, click the pin icon next to it.');
});

document.querySelector('[data-a="demo-open"]')?.addEventListener('click', () => {
  try {
    chrome.tabs.create({ url: DEMO_URL, active: true }).catch(() => window.open(DEMO_URL, '_blank', 'noopener'));
  } catch {
    window.open(DEMO_URL, '_blank', 'noopener');
  }
});

document.querySelector('[data-a="demo-copy"]')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const text = document.querySelector('[data-testid="demo-snippet"]')?.textContent || '';
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch {
    btn.textContent = 'Select & copy';
  }
  setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
});

// Let people tick steps off as they go (visual only, not persisted).
document.querySelectorAll('[data-testid="demo-steps"] li').forEach((li) => {
  li.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    li.classList.toggle('done');
  });
});
