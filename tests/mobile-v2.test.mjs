import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as DB from '../src/storage/db.js';
import * as Finance from '../src/services/finance.js';
import { getMobileCopy, getMobileCopyKeys } from '../src/mobile/copy.js';
import {
  formatLocalDate,
  formatPeriodLabel,
  getActivityViewModel,
  getHomeViewModel,
  normalizePeriod,
  shiftPeriod,
} from '../src/mobile/model.js';
import { handleMobileBack } from '../src/mobile/navigation.js';
import { formatMobileAmount, renderTransactionRows } from '../src/mobile/view.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_FINANCIAL_KEYS = [
  'mz_income',
  'mz_expenses',
  'mz_debts',
  'mz_investments',
  'mz_subscriptions',
  'mz_budget',
  'mz_settings',
];

function installMemoryStorage(seed = {}) {
  const priorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  const writes = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        writes.push({ key, value: String(value) });
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      },
    },
  });

  return {
    writes,
    restore() {
      if (priorDescriptor) Object.defineProperty(globalThis, 'localStorage', priorDescriptor);
      else delete globalThis.localStorage;
    },
  };
}

test('mobile Home reuses finance summary and transaction results without writing financial data', t => {
  const storage = installMemoryStorage({
    mz_income: [
      { id: 'inc-current', name: 'Salary', amount: 2200, source: 'salary', date: '2026-10-10' },
      { id: 'inc-older', name: 'Old salary', amount: 99, source: 'salary', date: '2026-09-10' },
    ],
    mz_expenses: [
      { id: 'exp-current', name: 'Groceries', amount: 350, category: 'food', date: '2026-10-08' },
    ],
    mz_debts: [{ id: 'debt-1', amount: 800, paid: 100 }],
    mz_investments: [{ id: 'inv-1', capital: 400, profit: 50 }],
    mz_subscriptions: [],
    mz_budget: { food: 500 },
    mz_settings: { theme: 'dark', currency: 'EGP' },
  });
  t.after(storage.restore);

  const home = getHomeViewModel(Finance, { month: 10, year: 2026 });
  const expectedSummary = Finance.getMonthSummary(10, 2026);

  assert.deepEqual(home.summary, expectedSummary);
  assert.equal(home.summary.income, 2200);
  assert.equal(home.summary.expenses, 350);
  assert.equal(home.summary.net, 1850);
  assert.equal(home.summary.debts, 700);
  assert.equal(home.summary.budgetRate, 70);
  assert.deepEqual(home.recent, Finance.searchTransactions('', 10, 2026).slice(0, 4));
  assert.equal(home.recent.length, 2);
  assert.deepEqual(storage.writes, []);
});

test('mobile Activity delegates text search to finance and filters the existing result by type', t => {
  const storage = installMemoryStorage({
    mz_income: [
      { id: 'inc-1', name: 'Monthly salary', amount: 2200, source: 'salary', date: '2026-10-10' },
    ],
    mz_expenses: [
      { id: 'exp-1', name: 'Coffee shop', amount: 90, category: 'food', date: '2026-10-09' },
      { id: 'exp-2', name: 'Bus ticket', amount: 25, category: 'transport', date: '2026-10-08' },
    ],
  });
  t.after(storage.restore);

  const activity = getActivityViewModel(Finance, {
    period: { month: 10, year: 2026 },
    query: 'coffee',
    type: 'expense',
  });
  assert.equal(activity.transactions.length, 1);
  assert.equal(activity.transactions[0].id, 'exp-1');
  assert.equal(activity.transactions[0].type, 'expense');
  assert.deepEqual(storage.writes, []);
});

test('mobile period and date formatters handle month boundaries and local date-only values', () => {
  assert.deepEqual(normalizePeriod({ month: 0, year: 2026 }, new Date(2026, 9, 25)), {
    month: 10,
    year: 2026,
  });
  assert.deepEqual(shiftPeriod({ month: 1, year: 2026 }, -1), { month: 12, year: 2025 });
  assert.deepEqual(shiftPeriod({ month: 12, year: 2026 }, 1), { month: 1, year: 2027 });
  assert.equal(formatLocalDate('2026-10-01', 'en-US'), 'Oct 1, 2026');
  assert.equal(formatLocalDate('2026-02-30', 'en-US'), '—');
  assert.equal(formatLocalDate('', 'ar-EG'), '—');
  assert.equal(
    formatPeriodLabel({ month: 10, year: 2026 }, 'en-US'),
    new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(2026, 9, 1)),
  );
});

test('mobile navigation consumes Android Back on secondary screens and exits from Home', () => {
  let navigatedHome = 0;
  assert.equal(handleMobileBack('activity', () => { navigatedHome += 1; }), true);
  assert.equal(navigatedHome, 1);
  assert.equal(handleMobileBack('more', () => { navigatedHome += 1; }), true);
  assert.equal(navigatedHome, 2);
  assert.equal(handleMobileBack('home', () => { navigatedHome += 1; }), false);
  assert.equal(navigatedHome, 2);
});

test('mobile transaction rendering escapes stored names and keeps amounts isolated from RTL text', () => {
  const maliciousName = '<img src=x onerror="alert(1)">';
  const html = renderTransactionRows([
    {
      id: 'exp-xss',
      name: maliciousName,
      amount: 1250,
      category: 'food',
      date: '2026-10-01',
      type: 'expense',
    },
  ], { locale: 'en-US', copy: getMobileCopy('en') });

  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
  assert.equal(html.includes(maliciousName), false);
  assert.match(html, /<time datetime="2026-10-01">Oct 1, 2026<\/time>/);
  assert.match(html, /<bdi class="transaction-amount transaction-amount--expense" dir="ltr">−[^<]+<\/bdi>/);
  assert.equal(formatMobileAmount(Number.NaN), '—');

  const invalidAmount = renderTransactionRows([
    { id: 'exp-invalid', name: 'Invalid', amount: -1, category: 'food', date: '2026-10-01', type: 'expense' },
  ], { locale: 'en-US', copy: getMobileCopy('en') });
  assert.match(invalidAmount, /−—<\/bdi>/);
});

test('mobile labels have matching Arabic and English keys', () => {
  assert.deepEqual(getMobileCopyKeys('ar').sort(), getMobileCopyKeys('en').sort());
  assert.equal(getMobileCopy('ar').home, 'الرئيسية');
  assert.equal(getMobileCopy('en').home, 'Home');
});

test('Mobile 2.0 has its own entry and retains the existing storage and backup key contract', () => {
  const mobileEntry = fs.readFileSync(path.join(repoRoot, 'mobile', 'index.html'), 'utf8');
  const pwaEntry = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'mobile', 'app.js'), 'utf8');
  const mobileCss = fs.readFileSync(path.join(repoRoot, 'src', 'mobile', 'mobile.css'), 'utf8');
  const comparison = fs.readFileSync(path.join(repoRoot, 'docs', 'mobile-v2-comparison.html'), 'utf8');

  assert.match(mobileEntry, /viewport-fit=cover/);
  assert.match(mobileEntry, /\/src\/mobile\/app\.js/);
  assert.doesNotMatch(mobileEntry, /\/src\/main\.js/);
  assert.match(pwaEntry, /src\/main\.js/);
  assert.match(appSource, /window\.App/);
  assert.match(mobileCss, /min-height:\s*48px/);
  assert.match(mobileCss, /safe-area-inset-bottom/);
  assert.match(mobileCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(comparison, /src="\.\.\/"/);
  assert.match(comparison, /src="\.\.\/mobile\/index\.html"/);
  assert.deepEqual(Object.values(DB.KEYS).sort(), [...EXPECTED_FINANCIAL_KEYS].sort());
  assert.deepEqual(Object.keys(DB.exportAll()).sort(), [...EXPECTED_FINANCIAL_KEYS].sort());
});
