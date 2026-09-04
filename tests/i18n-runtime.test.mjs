import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
globalThis.document = {
  documentElement: { lang: 'ar', dir: 'rtl' },
  getElementById: () => null,
  querySelectorAll: () => [],
};

const i18n = await import('../src/core/i18n.js');
const Notifications = await import('../src/services/notifications.js');
const { printSummary } = await import('../src/services/print.js');
const { validateAndNormalizeBackup } = await import('../src/services/backup.js');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arabic = /[\u0600-\u06FF]/;

function walk(directory) {
  const output = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) output.push(...walk(path));
    else if (/\.js$/i.test(name)) output.push(path);
  }
  return output;
}

test.beforeEach(() => {
  storage.clear();
  i18n.setLang('ar');
});

test('Arabic and English dictionaries stay in parity and English values contain no Arabic', () => {
  const arKeys = i18n.getTranslationKeys('ar').sort();
  const enKeys = i18n.getTranslationKeys('en').sort();
  assert.deepEqual(enKeys, arKeys);

  i18n.setLang('en');
  for (const key of enKeys) {
    assert.doesNotMatch(i18n.t(key), arabic, `Arabic leaked from English translation: ${key}`);
  }
  assert.equal(i18n.t('notif_mins_ago'), '', 'intentional empty translations must not fall back to their key');
  assert.equal(i18n.tf('notif_time_minutes', { count: 5 }), '5m ago');
});

test('all literal translation references in active sources exist in both dictionaries', () => {
  const sources = [
    readFileSync(join(root, 'index.html'), 'utf8'),
    ...walk(join(root, 'src')).map(path => readFileSync(path, 'utf8')),
  ].join('\n');
  const referenced = new Set([
    ...[...sources.matchAll(/data-i18n(?:-[a-z-]+)?="([a-zA-Z0-9_]+)"/g)].map(match => match[1]),
    ...[...sources.matchAll(/\btf?\(\s*['"]([a-zA-Z0-9_]+)['"]/g)].map(match => match[1]),
    ...[...sources.matchAll(/\b(?:titleKey|bodyKey):\s*['"]([a-zA-Z0-9_]+)['"]/g)].map(match => match[1]),
  ]);
  const keys = new Set(i18n.getTranslationKeys('ar'));
  assert.deepEqual([...referenced].filter(key => !keys.has(key)), []);
});

test('system notification templates re-render in the selected language with localized amounts', () => {
  i18n.setLang('en');
  const created = Notifications.addNotification({
    type: 'system',
    titleKey: 'smart_subscription_due_title',
    bodyKey: 'smart_subscription_due_body',
    params: { name: 'Streaming', amount: 1250 },
    link: 'subscriptions',
  });
  assert.match(created.title, /Subscription renews today/);

  let [notification] = Notifications.getNotifications();
  assert.match(notification.body, /Streaming/);
  assert.match(notification.body, /1,250 EGP/);
  assert.doesNotMatch(`${notification.title} ${notification.body}`, arabic);

  i18n.setLang('ar');
  [notification] = Notifications.getNotifications();
  assert.match(notification.title, /تجديد اشتراك اليوم/);
  assert.match(notification.body, /١٬٢٥٠ ج\.م/);
});

test('keyed category notification parameters re-render without mixed languages', () => {
  i18n.setLang('ar');
  const created = Notifications.addNotification({
    type: 'budget_over',
    titleKey: 'smart_category_over_title',
    bodyKey: 'smart_category_over_body',
    params: { categoryKey: 'cat_food', spent: 1_250, limit: 1_000 },
    link: 'budget',
  });
  assert.match(`${created.title} ${created.body}`, /الطعام/);

  i18n.setLang('en');
  const [notification] = Notifications.getNotifications();
  assert.match(`${notification.title} ${notification.body}`, /Food/);
  assert.doesNotMatch(`${notification.title} ${notification.body}`, arabic);
});

test('print report follows the selected language, direction, month, and labels', () => {
  const originalWindow = globalThis.window;
  let output = '';
  globalThis.window = {
    open() {
      return {
        document: {
          write(value) { output += value; },
          close() {},
        },
      };
    },
  };

  try {
    i18n.setLang('en');
    printSummary();
  } finally {
    globalThis.window = originalWindow;
  }

  assert.match(output, /<html lang="en" dir="ltr">/);
  assert.match(output, /Mizanity Summary/);
  assert.match(output, /Total Income/);
  assert.doesNotMatch(output, /month_\d|[\u0600-\u06FF]/);
});

test('backup validation errors follow the selected language', () => {
  i18n.setLang('en');
  assert.throws(
    () => validateAndNormalizeBackup({ unexpected: [] }),
    /backup contains missing or unknown keys|Invalid file format/i,
  );
});
