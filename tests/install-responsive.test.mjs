import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const { bindPWAInstall } = await import('../src/ui/install.js');

function fixture({ standalone = false } = {}) {
  const viewListeners = new Map();
  const buttonListeners = new Map();
  const button = {
    hidden: false,
    disabled: false,
    addEventListener(type, listener) { buttonListeners.set(type, listener); },
  };
  const view = {
    matchMedia: () => ({ matches: standalone }),
    addEventListener(type, listener) { viewListeners.set(type, listener); },
  };
  const root = { getElementById: id => id === 'installBtn' ? button : null };
  const nav = { standalone };
  bindPWAInstall({ root, view, nav });
  return { button, buttonListeners, viewListeners };
}

test('install control is exposed only for one actionable prompt', async () => {
  const { button, buttonListeners, viewListeners } = fixture();
  let prevented = 0;
  let prompted = 0;
  const event = {
    preventDefault() { prevented += 1; },
    async prompt() { prompted += 1; },
    userChoice: Promise.resolve({ outcome: 'dismissed' }),
  };

  assert.equal(button.hidden, true);
  viewListeners.get('beforeinstallprompt')(event);
  assert.equal(prevented, 1);
  assert.equal(button.hidden, false);

  await buttonListeners.get('click')();
  assert.equal(prompted, 1);
  assert.equal(button.hidden, true, 'dismissed one-shot prompt must not leave a dead button');
  assert.equal(button.disabled, false);

  await buttonListeners.get('click')();
  assert.equal(prompted, 1, 'a consumed prompt cannot run twice');

  const freshEvent = {
    preventDefault() {},
    async prompt() { prompted += 1; },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  };
  viewListeners.get('beforeinstallprompt')(freshEvent);
  assert.equal(button.hidden, false);
  viewListeners.get('appinstalled')();
  assert.equal(button.hidden, true);
  await buttonListeners.get('click')();
  assert.equal(prompted, 1, 'appinstalled clears any pending prompt');
});

test('standalone mode never exposes the install control', () => {
  const { button, viewListeners } = fixture({ standalone: true });
  let prevented = 0;
  viewListeners.get('beforeinstallprompt')({
    preventDefault() { prevented += 1; },
    prompt() {},
    userChoice: Promise.resolve({ outcome: 'dismissed' }),
  });
  assert.equal(prevented, 1);
  assert.equal(button.hidden, true);
});

test('320px header rules contain both hidden and actionable install states', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const installTag = html.match(/<button[^>]*id="installBtn"[^>]*>/)?.[0] || '';
  assert.match(installTag, /type="button"/);
  assert.match(installTag, /\bhidden\b/);
  assert.match(installTag, /data-i18n-aria-label="install_app"/);

  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.nav-btn\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*#filterYear\s*\{[^}]*64px/);
  assert.match(css, /\.chart-container canvas\s*\{\s*max-width:\s*100% !important/);

  const serviceWorker = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
  assert.ok(serviceWorker.includes("'./src/ui/install.js'"));
});
