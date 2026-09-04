import assert from 'node:assert/strict';

globalThis.localStorage = {
  data: new Map(),
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
  setItem(key, value) { this.data.set(key, String(value)); },
  removeItem(key) { this.data.delete(key); },
  clear() { this.data.clear(); },
};

globalThis.document = {
  documentElement: { lang: 'ar', dir: 'rtl' },
  querySelectorAll: () => [],
  getElementById: () => null,
};

const Finance = await import('./src/services/finance.js');
const { setLang, toggleLang, getLang, t } = await import('./src/core/i18n.js');

console.log('--- STARTING CORE TESTS ---');

setLang('ar');
assert.equal(getLang(), 'ar');
assert.notEqual(t('stat_key_metrics'), 'stat_key_metrics');
assert.equal(toggleLang(), 'en');
assert.equal(getLang(), 'en');
assert.notEqual(t('stat_key_metrics'), 'stat_key_metrics');

localStorage.clear();
const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;
const date = day => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

Finance.addIncome({ name: 'Salary', source: 'salary', amount: 15_000, date: date(1), notes: '' });
Finance.addIncome({ name: 'Freelance', source: 'freelance', amount: 5_000, date: date(15), notes: '' });
Finance.addExpense({ name: 'Food', category: 'food', amount: 800, date: date(1), notes: '' });
Finance.addExpense({ name: 'Entertainment', category: 'entertainment', amount: 2_000, date: date(2), notes: '' });
Finance.setBudget({ food: 500, entertainment: 1_000 });

const summary = Finance.getMonthSummary(month, year);
assert.equal(summary.income, 20_000);
assert.equal(summary.expenses, 2_800);
assert.equal(summary.net, 17_200);
assert.equal(summary.budgetTotal, 1_500);
assert.ok(summary.budgetRate > 100);

const trend = Finance.getBalanceTrend(month, year);
assert.equal(trend.data[0], 14_200);
assert.equal(trend.data[1], 12_200);
assert.equal(trend.data[14], 17_200);

console.log('Core finance and translation tests passed.');
