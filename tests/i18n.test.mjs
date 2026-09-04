import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('only an exact stored en value selects English', async t => {
  const originalLocalStorage = globalThis.localStorage;
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });

  const cases = [
    ['en', 'en'],
    ['ar', 'ar'],
    ['EN', 'ar'],
    ['fr', 'ar'],
    ['', 'ar'],
    [null, 'ar'],
  ];

  for (const [storedValue, expected] of cases) {
    globalThis.localStorage = {
      getItem(key) {
        assert.equal(key, 'cashpilot_lang');
        return storedValue;
      },
    };

    const moduleUrl = new URL('../src/core/i18n.js', import.meta.url);
    moduleUrl.searchParams.set('stored-value', String(storedValue));
    const { getLang } = await import(moduleUrl.href);
    assert.equal(getLang(), expected, `stored value ${String(storedValue)}`);
  }
});

test('language control is visible and names the initial target language', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const button = html.match(/<button[^>]*id="moreLangBtn"[^>]*>/)?.[0] || '';

  assert.match(button, /type="button"/);
  assert.doesNotMatch(button, /display\s*:\s*none/i);
  assert.match(button, /aria-label="التحويل للإنجليزية"/);
  assert.match(button, /title="التحويل للإنجليزية"/);
});

test('language toggle persists and synchronizes document direction and control label', async t => {
  const originalLocalStorage = globalThis.localStorage;
  const originalDocument = globalThis.document;
  const stored = new Map();
  const button = {
    attributes: {},
    dataset: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };

  globalThis.localStorage = {
    getItem(key) { return stored.get(key) ?? null; },
    setItem(key, value) { stored.set(key, String(value)); },
  };
  globalThis.document = {
    documentElement: { lang: '', dir: '' },
    getElementById: id => id === 'moreLangBtn' ? button : null,
    querySelectorAll: () => [],
  };
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });

  const moduleUrl = new URL('../src/core/i18n.js', import.meta.url);
  moduleUrl.searchParams.set('control-sync', String(Date.now()));
  const i18n = await import(moduleUrl.href);

  assert.deepEqual(i18n.syncLanguageControl(), {
    language: 'ar',
    label: 'التحويل للإنجليزية',
  });
  assert.equal(button.attributes['aria-label'], 'التحويل للإنجليزية');
  assert.equal(button.dataset.currentLanguage, 'ar');

  i18n.setLang('en');
  assert.equal(stored.get('cashpilot_lang'), 'en');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.documentElement.dir, 'ltr');
  assert.equal(button.attributes['aria-label'], 'Switch to Arabic');
  assert.equal(button.attributes.title, 'Switch to Arabic');
  assert.equal(button.dataset.currentLanguage, 'en');

  assert.equal(i18n.toggleLang(), 'ar');
  assert.equal(stored.get('cashpilot_lang'), 'ar');
  assert.equal(document.documentElement.lang, 'ar');
  assert.equal(document.documentElement.dir, 'rtl');
  assert.equal(button.attributes['aria-label'], 'التحويل للإنجليزية');
  assert.equal(button.dataset.currentLanguage, 'ar');
});
