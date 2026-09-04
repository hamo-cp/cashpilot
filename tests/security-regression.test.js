import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

class MemoryStorage {
  constructor() {
    this.data = new Map();
    this.failures = [];
  }
  failNext(operation, key) {
    this.failures.push({ operation, key });
  }
  maybeFail(operation, key) {
    const next = this.failures[0];
    if (next?.operation === operation && next.key === key) {
      this.failures.shift();
      throw new Error(`injected ${operation} failure for ${key}`);
    }
  }
  getItem(key) {
    this.maybeFail('getItem', key);
    return this.data.has(key) ? this.data.get(key) : null;
  }
  setItem(key, value) {
    this.maybeFail('setItem', key);
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.maybeFail('removeItem', key);
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
    this.failures = [];
  }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
globalThis.document = {
  documentElement: { lang: 'ar', dir: 'rtl' },
  querySelectorAll: () => [],
  getElementById: () => null,
};

const DB = await import('../src/storage/db.js');
const Finance = await import('../src/services/finance.js');
const {
  BACKUP_LIMITS,
  BackupValidationError,
  importData,
  validateAndNormalizeBackup,
} = await import('../src/services/backup.js');
const { normalizeMarketData } = await import('../src/services/market.js');
const Components = await import('../src/ui/components.js');
const Notifications = await import('../src/services/notifications.js');
const {
  SUBSCRIPTION_LIMITS,
  openSubscriptionModal,
  subscriptionItemHTML,
  saveSubscription,
} = await import('../src/pages/subscriptions.js');
const { closeModal } = await import('../src/ui/modal.js');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const currentYear = 2026;
const currentMonth = 9;

function fullBackup(overrides = {}) {
  return {
    mz_income: [],
    mz_expenses: [],
    mz_debts: [],
    mz_investments: [],
    mz_subscriptions: [],
    mz_budget: {
      food: 0,
      transport: 0,
      education: 0,
      entertainment: 0,
      shopping: 0,
      health: 0,
      bills: 0,
      internet: 0,
    },
    mz_settings: { theme: 'dark', currency: 'EGP' },
    ...overrides,
  };
}

function validMarket(overrides = {}) {
  return {
    usdEgp: { price: 48.5, change: 0, changePercent: 0 },
    globalGold: { price: 2400, change: 0, changePercent: 0 },
    globalSilver: { price: 28, change: 0, changePercent: 0 },
    local: { gold24k: 3742, gold21k: 3274, silver: 43 },
    egx: {
      comi: { price: 75, prevClose: 74, change: 1, changePercent: 1.35, symbol: 'COMI.CA' },
    },
    fetchedAt: '10:30:00',
    ...overrides,
  };
}

test.beforeEach(() => storage.clear());

test('backup validator rejects unknown top-level and nested fields before storage', () => {
  assert.throws(
    () => validateAndNormalizeBackup({ ...fullBackup(), mz_notifications: [] }),
    BackupValidationError,
  );
  assert.throws(
    () => validateAndNormalizeBackup(fullBackup({
      mz_income: [{
        id: 'i1',
        name: 'Salary',
        amount: 100,
        source: 'salary',
        date: '2026-09-01',
        notes: '',
        unexpected: true,
      }],
    })),
    BackupValidationError,
  );
});

test('official backup preserves literal text while reconstructing safe unique ids', () => {
  const literal = `اشتراك <العائلة> & "HD" — O'Reilly`;
  const normalized = validateAndNormalizeBackup(fullBackup({
    mz_subscriptions: [{
      id: "x');window.__cpXss=1;//",
      name: literal,
      amount: 250,
      dueDate: '2026-09-10',
    }],
  }));

  assert.equal(normalized.mz_subscriptions[0].name, literal);
  assert.notEqual(normalized.mz_subscriptions[0].id, "x');window.__cpXss=1;//");
  assert.match(normalized.mz_subscriptions[0].id, /^import_subscription_0_/);
  assert.equal(DB.importAll(normalized).ok, true);
  assert.equal(DB.exportAll().mz_subscriptions[0].name, literal);
});

test('backup round-trip preserves long historical text exactly within the file-size limit', () => {
  const longName = `<العائلة & الأصدقاء> ${'ن'.repeat(2_048)}`;
  const longNotes = `"ملاحظة" — O'Reilly ${'ت'.repeat(4_096)}`;
  const historical = fullBackup({
    mz_income: [{
      id: 'income-history', name: longName, amount: 10, source: 'salary',
      date: '2026-09-01', notes: longNotes,
    }],
    mz_expenses: [{
      id: 'expense-history', name: longName, amount: 20, category: 'food',
      date: '2026-09-02', notes: longNotes,
    }],
    mz_debts: [{
      id: 'debt-history', creditor: longName, amount: 30, paid: 5,
      dueDate: '2026-09-03', notes: longNotes,
    }],
    mz_investments: [{
      id: 'investment-history', name: longName, type: 'stocks', capital: 40,
      quantity: 1, profit: -2, startDate: '2026-09-04',
    }],
    mz_subscriptions: [{
      id: 'subscription-history', name: longName, amount: 50, dueDate: '2026-09-05',
    }],
  });

  for (const [key, value] of Object.entries(historical)) {
    storage.setItem(key, JSON.stringify(value));
  }
  const exported = DB.exportAll();
  assert.ok(Buffer.byteLength(JSON.stringify(exported)) <= BACKUP_LIMITS.maxBytes);
  storage.clear();

  assert.equal(DB.importAll(validateAndNormalizeBackup(exported)).ok, true);
  const restored = DB.exportAll();
  assert.equal(restored.mz_income[0].name, longName);
  assert.equal(restored.mz_income[0].notes, longNotes);
  assert.equal(restored.mz_expenses[0].name, longName);
  assert.equal(restored.mz_expenses[0].notes, longNotes);
  assert.equal(restored.mz_debts[0].creditor, longName);
  assert.equal(restored.mz_debts[0].notes, longNotes);
  assert.equal(restored.mz_investments[0].name, longName);
  assert.equal(restored.mz_subscriptions[0].name, longName);
});

test('subscription backup enforces explicit count, amount, due-date, and name boundaries', () => {
  const subscription = (id, overrides = {}) => ({
    id: `sub-${id}`,
    name: 'خدمة',
    amount: 1,
    dueDate: '2026-09-30',
    ...overrides,
  });

  const atFieldLimits = validateAndNormalizeBackup(fullBackup({
    mz_subscriptions: [subscription('boundary', {
      name: 'x'.repeat(2_048),
      amount: BACKUP_LIMITS.maxAmount,
    })],
  }));
  assert.equal(atFieldLimits.mz_subscriptions[0].name.length, 2_048);
  assert.equal(atFieldLimits.mz_subscriptions[0].amount, BACKUP_LIMITS.maxAmount);

  assert.throws(() => validateAndNormalizeBackup(fullBackup({
    mz_subscriptions: [subscription('long-name', {
      name: 'x'.repeat(BACKUP_LIMITS.maxTextLength + 1),
    })],
  })), BackupValidationError);
  assert.throws(() => validateAndNormalizeBackup(fullBackup({
    mz_subscriptions: [subscription('large-amount', {
      amount: BACKUP_LIMITS.maxAmount + 1,
    })],
  })), BackupValidationError);
  assert.throws(() => validateAndNormalizeBackup(fullBackup({
    mz_subscriptions: [subscription('bad-date', { dueDate: '2026-02-30' })],
  })), BackupValidationError);

  const atCountLimit = Array.from(
    { length: BACKUP_LIMITS.maxRecords },
    (_, index) => subscription(index),
  );
  assert.equal(validateAndNormalizeBackup(fullBackup({
    mz_subscriptions: atCountLimit,
  })).mz_subscriptions.length, BACKUP_LIMITS.maxRecords);
  assert.throws(() => validateAndNormalizeBackup(fullBackup({
    mz_subscriptions: [...atCountLimit, subscription('overflow')],
  })), BackupValidationError);
});

test('legacy six-key backups migrate with subscriptions cleared', () => {
  const backup = fullBackup();
  delete backup.mz_subscriptions;
  const normalized = validateAndNormalizeBackup(backup);
  assert.equal(normalized.mz_subscriptions, null);
});

test('all-null official backup clears previous official values but preserves unrelated storage', () => {
  storage.setItem('sentinel', 'keep');
  for (const key of Object.values(DB.KEYS)) storage.setItem(key, JSON.stringify([{ old: true }]));
  const cleared = Object.fromEntries(Object.values(DB.KEYS).map(key => [key, null]));

  assert.equal(DB.importAll(validateAndNormalizeBackup(cleared)).ok, true);
  for (const key of Object.values(DB.KEYS)) assert.equal(storage.getItem(key), null);
  assert.equal(storage.getItem('sentinel'), 'keep');
});

test('DB import rejects extra keys and rolls back a failed multi-key write', () => {
  storage.setItem(DB.KEYS.INCOME, JSON.stringify([{ id: 'before' }]));
  storage.setItem(DB.KEYS.EXPENSES, JSON.stringify([{ id: 'before-expense' }]));
  assert.deepEqual(DB.importAll({ [DB.KEYS.INCOME]: [], evil: [] }), {
    ok: false,
    reason: 'invalid_input',
    rollbackFailed: false,
    failedKeys: [],
  });
  assert.deepEqual(DB.getArray(DB.KEYS.INCOME), [{ id: 'before' }]);

  storage.failNext('setItem', DB.KEYS.EXPENSES);
  assert.deepEqual(DB.importAll({ [DB.KEYS.INCOME]: [], [DB.KEYS.EXPENSES]: [] }), {
    ok: false,
    reason: 'write_failed',
    rollbackFailed: false,
    failedKeys: [],
  });
  assert.deepEqual(DB.getArray(DB.KEYS.INCOME), [{ id: 'before' }]);
  assert.deepEqual(DB.getArray(DB.KEYS.EXPENSES), [{ id: 'before-expense' }]);
});

test('backup import warns the user when a write and its rollback both fail', () => {
  storage.setItem(DB.KEYS.INCOME, JSON.stringify([{ id: 'before' }]));
  storage.setItem(DB.KEYS.EXPENSES, JSON.stringify([{ id: 'before-expense' }]));
  storage.failNext('setItem', DB.KEYS.EXPENSES);
  storage.failNext('setItem', DB.KEYS.INCOME);

  const serialized = JSON.stringify(fullBackup());
  const container = {
    children: [],
    appendChild(node) { this.children.push(node); },
    get firstChild() { return this.children[0] ?? null; },
  };
  const originalDocument = globalThis.document;
  const originalFileReader = globalThis.FileReader;
  const originalSetTimeout = globalThis.setTimeout;
  let successes = 0;

  globalThis.document = {
    ...originalDocument,
    getElementById: id => id === 'toastContainer' ? container : null,
    createElement: () => ({
      children: [],
      attributes: {},
      style: {},
      append(...nodes) { this.children.push(...nodes); },
      setAttribute(name, value) { this.attributes[name] = value; },
      remove() {},
    }),
    createTextNode: value => ({ textContent: value }),
  };
  globalThis.FileReader = class {
    readAsText(file) {
      this.onload({ target: { result: file.contents } });
    }
  };
  globalThis.setTimeout = () => 0;

  try {
    importData({
      target: {
        files: [{ size: Buffer.byteLength(serialized), contents: serialized }],
        value: 'selected',
      },
    }, () => { successes += 1; });
  } finally {
    globalThis.document = originalDocument;
    globalThis.FileReader = originalFileReader;
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.equal(successes, 0);
  assert.equal(container.children.length, 1);
  assert.match(container.children[0].children[1].textContent, /تعذر استعادة بعض البيانات السابقة/);
  assert.deepEqual(DB.getArray(DB.KEYS.INCOME), []);
  assert.deepEqual(DB.getArray(DB.KEYS.EXPENSES), [{ id: 'before-expense' }]);
});

test('dynamic renderers keep imported text and ids inert', () => {
  const payload = '<img src=x onerror="window.__cpXss=1">';
  const idPayload = "x');window.__cpXss=1;//";

  const income = Components.incomeItemHTML({
    id: idPayload,
    name: payload,
    amount: 100,
    source: 'salary',
    date: '2026-09-01',
    notes: payload,
  });
  const subscription = subscriptionItemHTML({
    id: idPayload,
    name: payload,
    amount: 20,
    dueDate: '2026-09-10',
  });
  const notification = Notifications.notifItemHTML({
    id: idPayload,
    title: payload,
    body: payload,
    severity: 'info',
    read: false,
    createdAt: new Date().toISOString(),
    link: 'dashboard',
  });

  for (const html of [income, subscription, notification]) {
    assert.equal(html.includes('<img'), false);
    assert.equal(html.includes('onclick='), false);
    assert.equal(html.includes(idPayload), false);
    assert.match(html, /data-app-action=/);
  }
});

test('market normalizer accepts bounded numbers and rejects executable or non-finite values', () => {
  assert.equal(normalizeMarketData(validMarket()).usdEgp.price, 48.5);
  assert.equal(normalizeMarketData(validMarket({
    usdEgp: { price: '<img src=x onerror=alert(1)>', change: 0, changePercent: 0 },
  })), null);
  assert.equal(normalizeMarketData(validMarket({
    local: { gold24k: Infinity, gold21k: 3274, silver: 43 },
  })), null);
  assert.equal(normalizeMarketData(validMarket({
    local: { gold24k: -1, gold21k: 3274, silver: 43 },
  })), null);
});

test('budget overage and balance trend use uncapped, date-ordered values', () => {
  Finance.addIncome({ name: 'Income', amount: 100, source: 'salary', date: '2026-09-15', notes: '' });
  Finance.addExpense({ name: 'Day 1', amount: 25, category: 'food', date: '2026-09-01', notes: '' });
  Finance.addExpense({ name: 'Day 2', amount: 10, category: 'food', date: '2026-09-02', notes: '' });
  Finance.setBudget({ food: 20 });

  const summary = Finance.getMonthSummary(currentMonth, currentYear);
  assert.equal(summary.budgetRate, 175);
  const trend = Finance.getBalanceTrend(currentMonth, currentYear);
  assert.equal(trend.data[0], -25);
  assert.equal(trend.data[1], -35);
  assert.equal(trend.data[14], 65);
});

test('subscription edit contract updates once and invokes callback once', () => {
  DB.setArray(DB.KEYS.SUBSCRIPTIONS, [{
    id: 'sub-1',
    name: 'Before',
    amount: 100,
    dueDate: '2026-09-10',
  }]);

  const elements = {
    'sub-name': { value: 'After' },
    'sub-amount': { value: '250' },
    'sub-due': { value: '2026-09-11' },
  };
  const originalGetElementById = document.getElementById;
  document.getElementById = id => elements[id] || null;
  let callbacks = 0;
  try {
    assert.equal(saveSubscription('sub-1', () => { callbacks += 1; }), true);
  } finally {
    document.getElementById = originalGetElementById;
  }

  assert.equal(callbacks, 1);
  assert.deepEqual(Finance.getSubscriptions()[0], {
    id: 'sub-1',
    name: 'After',
    amount: 250,
    dueDate: '2026-09-11',
  });
});

test('invalid subscription shows error feedback without changing data', () => {
  let focusedId = null;
  const field = (id, value) => ({
    value,
    attributes: {},
    setAttribute(name, attributeValue) { this.attributes[name] = attributeValue; },
    removeAttribute(name) { delete this.attributes[name]; },
    focus() { focusedId = id; },
  });
  const elements = {
    'sub-name': field('sub-name', '   '),
    'sub-amount': field('sub-amount', '25'),
    'sub-due': field('sub-due', '2026-09-30'),
  };
  const container = {
    children: [],
    appendChild(node) { this.children.push(node); },
    get firstChild() { return this.children[0] ?? null; },
  };
  const originalDocument = globalThis.document;
  const originalSetTimeout = globalThis.setTimeout;
  let callbacks = 0;

  globalThis.document = {
    ...originalDocument,
    getElementById: id => elements[id] || (id === 'toastContainer' ? container : null),
    createElement: () => ({
      children: [],
      className: '',
      attributes: {},
      style: {},
      append(...nodes) { this.children.push(...nodes); },
      setAttribute(name, value) { this.attributes[name] = value; },
      remove() {},
    }),
    createTextNode: value => ({ textContent: value }),
  };
  globalThis.setTimeout = () => 0;

  try {
    assert.equal(saveSubscription(null, () => { callbacks += 1; }), false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.equal(callbacks, 0);
  assert.deepEqual(Finance.getSubscriptions(), []);
  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].className, 'toast error');
  assert.equal(container.children[0].attributes.role, 'alert');
  assert.match(container.children[0].children[1].textContent, /يرجى إدخال بيانات صحيحة/);
  assert.equal(elements['sub-name'].attributes['aria-invalid'], 'true');
  assert.equal(elements['sub-amount'].attributes['aria-invalid'], undefined);
  assert.equal(elements['sub-due'].attributes['aria-invalid'], undefined);
  assert.equal(focusedId, 'sub-name');
});

test('opening the subscription modal clears stale invalid-field semantics', () => {
  const field = value => ({
    value,
    attributes: { 'aria-invalid': 'true' },
    removeAttribute(name) { delete this.attributes[name]; },
    focus() {},
  });
  const fields = {
    'sub-name': field('stale'),
    'sub-amount': field('0'),
    'sub-due': field('invalid'),
  };
  const classes = new Set(['modal-overlay']);
  const overlay = {
    classList: {
      add(name) { classes.add(name); },
      contains(name) { return classes.has(name); },
      remove(name) { classes.delete(name); },
    },
    contains() { return false; },
    focus() {},
    querySelector(selector) {
      if (selector === '.modal, .confirm-box') return this;
      if (selector === '[data-modal-initial-focus]') return fields['sub-name'];
      return null;
    },
    querySelectorAll() { return []; },
  };
  const originalDocument = globalThis.document;
  globalThis.document = {
    ...originalDocument,
    activeElement: null,
    getElementById: id => id === 'subscriptionModal' ? overlay : fields[id] || null,
  };

  try {
    openSubscriptionModal();
    for (const input of Object.values(fields)) {
      assert.equal(input.attributes['aria-invalid'], undefined);
    }
    closeModal('subscriptionModal');
  } finally {
    globalThis.document = originalDocument;
  }
});

test('new subscriptions enforce the same explicit count, amount, date, and name limits', () => {
  const elements = {
    'sub-name': { value: 'x'.repeat(SUBSCRIPTION_LIMITS.maxNameLength) },
    'sub-amount': { value: String(SUBSCRIPTION_LIMITS.maxAmount) },
    'sub-due': { value: '2026-09-30' },
  };
  const originalGetElementById = document.getElementById;
  document.getElementById = id => elements[id] || null;

  try {
    assert.equal(saveSubscription(null), true);
    assert.equal(Finance.getSubscriptions().length, 1);

    elements['sub-name'].value = `${elements['sub-name'].value}x`;
    assert.equal(saveSubscription(null), false);
    elements['sub-name'].value = 'Service';

    elements['sub-amount'].value = String(SUBSCRIPTION_LIMITS.maxAmount + 1);
    assert.equal(saveSubscription(null), false);
    elements['sub-amount'].value = 'Infinity';
    assert.equal(saveSubscription(null), false);
    elements['sub-amount'].value = '1';

    elements['sub-due'].value = '2026-02-30';
    assert.equal(saveSubscription(null), false);

    DB.setArray(DB.KEYS.SUBSCRIPTIONS, Array.from(
      { length: SUBSCRIPTION_LIMITS.maxRecords },
      (_, index) => ({
        id: `existing-${index}`,
        name: 'Existing',
        amount: 1,
        dueDate: '2026-09-30',
      }),
    ));
    elements['sub-due'].value = '2026-09-30';
    assert.equal(saveSubscription(null), false);
    assert.equal(Finance.getSubscriptions().length, SUBSCRIPTION_LIMITS.maxRecords);
  } finally {
    document.getElementById = originalGetElementById;
  }
});

function walkTextFiles(directory) {
  const output = [];
  for (const name of readdirSync(directory)) {
    if (name === '.git' || name === 'node_modules') continue;
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) output.push(...walkTextFiles(path));
    else if (/\.(?:js|html|css|json|md)$/i.test(name)) output.push(path);
  }
  return output;
}

test('Gemini runtime and identifiers are absent from the current tree', () => {
  const forbidden = [
    'gemini',
    'generativelanguage.googleapis.com',
    'GEMINI_API_KEY',
    '/api/gemini',
    'ai-advisor',
    'aiGenerateBtn',
    'aiInsightsResult',
    'generateAIInsights',
  ];
  const hits = [];
  for (const path of walkTextFiles(root)) {
    if (resolve(path) === resolve(fileURLToPath(import.meta.url))) continue;
    const content = readFileSync(path, 'utf8');
    for (const needle of forbidden) {
      if (content.toLowerCase().includes(needle.toLowerCase())) {
        hits.push(`${relative(root, path)}: ${needle}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});

function collectImports(entry, seen = new Set()) {
  const absolute = resolve(root, entry);
  if (seen.has(absolute)) return seen;
  seen.add(absolute);
  const source = readFileSync(absolute, 'utf8');
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    collectImports(relative(root, resolve(dirname(absolute), match[1])), seen);
  }
  return seen;
}

test('service worker precaches the active import closure and no external executable', () => {
  const serviceWorker = readFileSync(join(root, 'service-worker.js'), 'utf8');
  for (const path of collectImports('src/main.js')) {
    const modulePath = relative(root, path).replaceAll('\\', '/');
    assert.ok(serviceWorker.includes(`./${modulePath}`), `missing from precache: ${modulePath}`);
  }
  assert.ok(serviceWorker.includes('./vendor/chart.js-4.4.0/chart.umd.js'));
  assert.equal(serviceWorker.includes('cdn.jsdelivr.net/npm/chart.js'), false);
  assert.equal(serviceWorker.includes("mode: 'no-cors'"), false);
});

test('vendored chart content matches the reviewed digest across line endings', () => {
  const chart = readFileSync(join(root, 'vendor/chart.js-4.4.0/chart.umd.js'), 'utf8')
    .replace(/\r\n?/g, '\n');
  const digest = createHash('sha256').update(chart, 'utf8').digest('hex');
  assert.equal(digest, '321e3a3fa98da4aaa957d10be57cbb514de0989eed8f9d726b5d05902cd01904');
  assert.ok(existsSync(join(root, 'vendor/chart.js-4.4.0/LICENSE.md')));
});
