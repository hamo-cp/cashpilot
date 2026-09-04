/**
 * @module services/finance
 * @description طبقة المنطق المالي — Business Logic Layer.
 * تعتمد على storage/db فقط، لا تعرف شيئاً عن DOM أو UI.
 */

import * as DB from '../storage/db.js';
import { uid, today, matchPeriod } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { BUDGET_CATEGORIES, EXPENSE_CATEGORIES } from '../core/constants.js';

/* ── تنظيف record يأتي من localStorage — يمنع crash عند بيانات تالفة ── */
function sanitizeAmount(val) {
  const n = parseFloat(val);
  return isFinite(n) && n >= 0 ? n : 0;
}

/* ════════════════════════════════════════
   الدخل
   ════════════════════════════════════════ */

export function getIncome() {
  return DB.getArray(DB.KEYS.INCOME);
}

export function addIncome(item) {
  const list    = getIncome();
  const newItem = { id: uid(), createdAt: today(), ...item };
  list.push(newItem);
  DB.setArray(DB.KEYS.INCOME, list);
  return newItem;
}

export function updateIncome(id, updates) {
  const list = getIncome();
  const idx  = list.findIndex(i => i.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...updates };
  DB.setArray(DB.KEYS.INCOME, list);
  return true;
}

export function deleteIncome(id) {
  DB.setArray(DB.KEYS.INCOME, getIncome().filter(i => i.id !== id));
}

export function totalIncome(month, year) {
  return getIncome()
    .filter(i => matchPeriod(i.date, month, year))
    .reduce((sum, i) => sum + sanitizeAmount(i.amount), 0);
}

/* ════════════════════════════════════════
   المصروفات
   ════════════════════════════════════════ */

export function getExpenses() {
  return DB.getArray(DB.KEYS.EXPENSES);
}

export function addExpense(item) {
  const list    = getExpenses();
  const newItem = { id: uid(), createdAt: today(), ...item };
  list.push(newItem);
  DB.setArray(DB.KEYS.EXPENSES, list);
  return newItem;
}

export function updateExpense(id, updates) {
  const list = getExpenses();
  const idx  = list.findIndex(i => i.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...updates };
  DB.setArray(DB.KEYS.EXPENSES, list);
  return true;
}

export function deleteExpense(id) {
  DB.setArray(DB.KEYS.EXPENSES, getExpenses().filter(i => i.id !== id));
}

export function totalExpenses(month, year) {
  return getExpenses()
    .filter(i => matchPeriod(i.date, month, year))
    .reduce((sum, i) => sum + sanitizeAmount(i.amount), 0);
}

export function expensesByCategory(month, year) {
  const result = Object.create(null);
  getExpenses()
    .filter(i => matchPeriod(i.date, month, year))
    .forEach(i => {
      const category = Object.hasOwn(EXPENSE_CATEGORIES, i.category) ? i.category : 'other';
      result[category] = (result[category] || 0) + sanitizeAmount(i.amount);
    });
  return result;
}

export function dailyExpenses(month, year) {
  const result      = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) result[d] = 0;

  getExpenses()
    .filter(i => matchPeriod(i.date, month, year))
    .forEach(i => {
      const day     = new Date(i.date).getDate();
      result[day]   = (result[day] || 0) + sanitizeAmount(i.amount);
    });
  return result;
}

export function dailyIncome(month, year) {
  const result = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) result[day] = 0;

  getIncome()
    .filter(item => matchPeriod(item.date, month, year))
    .forEach(item => {
      const day = new Date(item.date).getDate();
      result[day] = (result[day] || 0) + sanitizeAmount(item.amount);
    });
  return result;
}

/* ════════════════════════════════════════
   الديون
   ════════════════════════════════════════ */

export function getDebts() {
  return DB.getArray(DB.KEYS.DEBTS);
}

export function addDebt(item) {
  const list    = getDebts();
  const newItem = { id: uid(), paid: 0, ...item };
  list.push(newItem);
  DB.setArray(DB.KEYS.DEBTS, list);
  return newItem;
}

export function updateDebt(id, updates) {
  const list = getDebts();
  const idx  = list.findIndex(i => i.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...updates };
  DB.setArray(DB.KEYS.DEBTS, list);
  return true;
}

export function deleteDebt(id) {
  DB.setArray(DB.KEYS.DEBTS, getDebts().filter(i => i.id !== id));
}

export function totalDebts() {
  return getDebts().reduce((sum, d) => {
    const remaining = sanitizeAmount(d.amount) - sanitizeAmount(d.paid);
    return sum + Math.max(0, remaining);
  }, 0);
}

/* ════════════════════════════════════════
   الاستثمارات
   ════════════════════════════════════════ */

export function getInvestments() {
  return DB.getArray(DB.KEYS.INVESTMENTS);
}

export function addInvestment(item) {
  const list    = getInvestments();
  const newItem = { id: uid(), ...item };
  list.push(newItem);
  DB.setArray(DB.KEYS.INVESTMENTS, list);
  return newItem;
}

export function updateInvestment(id, updates) {
  const list = getInvestments();
  const idx  = list.findIndex(i => i.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...updates };
  DB.setArray(DB.KEYS.INVESTMENTS, list);
  return true;
}

export function deleteInvestment(id) {
  DB.setArray(DB.KEYS.INVESTMENTS, getInvestments().filter(i => i.id !== id));
}

export function calcROI(inv) {
  const capital = parseFloat(inv.capital) || 0;
  const profit  = parseFloat(inv.profit)  || 0;
  if (capital === 0) return 0;
  return (profit / capital) * 100;
}

export function totalInvestments() {
  return getInvestments().reduce((sum, i) => sum + sanitizeAmount(i.capital), 0);
}

export function totalInvestmentProfit() {
  return getInvestments().reduce((sum, i) => {
    const p = parseFloat(i.profit);
    return sum + (isFinite(p) ? p : 0);
  }, 0);
}

/* ════════════════════════════════════════
   الاشتراكات الشهرية
   ════════════════════════════════════════ */

export function getSubscriptions() {
  return DB.getArray(DB.KEYS.SUBSCRIPTIONS);
}

export function addSubscription(item) {
  const list = getSubscriptions();
  const newItem = { id: uid(), createdAt: today(), ...item };
  list.push(newItem);
  DB.setArray(DB.KEYS.SUBSCRIPTIONS, list);
  return newItem;
}

export function updateSubscription(id, updates) {
  const list = getSubscriptions();
  const idx  = list.findIndex(i => i.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...updates };
  DB.setArray(DB.KEYS.SUBSCRIPTIONS, list);
  return true;
}

export function deleteSubscription(id) {
  DB.setArray(DB.KEYS.SUBSCRIPTIONS, getSubscriptions().filter(i => i.id !== id));
}

/* ════════════════════════════════════════
   الميزانية
   ════════════════════════════════════════ */

export function getBudget() {
  const stored = DB.get(DB.KEYS.BUDGET);
  return Object.fromEntries(BUDGET_CATEGORIES.map(({ key }) => [key, sanitizeAmount(stored?.[key])]));
}

export function setBudget(budget) {
  return DB.set(DB.KEYS.BUDGET, Object.fromEntries(
    BUDGET_CATEGORIES.map(({ key }) => [key, sanitizeAmount(budget?.[key])]),
  ));
}

/* ════════════════════════════════════════
   الإعدادات
   ════════════════════════════════════════ */

export function getSettings() {
  return DB.get(DB.KEYS.SETTINGS) || { theme: 'dark', currency: 'EGP' };
}

export function saveSettings(updates) {
  DB.set(DB.KEYS.SETTINGS, { ...getSettings(), ...updates });
}

/* ════════════════════════════════════════
   التحليلات
   ════════════════════════════════════════ */

export function getMonthSummary(month, year) {
  const income      = totalIncome(month, year);
  const expenses    = totalExpenses(month, year);
  const debts       = totalDebts();
  const investments = totalInvestments();
  const net         = income - expenses;
  const savingRate  = income > 0 ? (net / income) * 100 : 0;
  const spendRate   = income > 0 ? (expenses / income) * 100 : 0;

  const budget      = getBudget();
  const budgetTotal = Object.values(budget).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const budgetRate  = budgetTotal > 0 ? (expenses / budgetTotal) * 100 : 0;

  return { income, expenses, net, debts, investments, savingRate, spendRate, budgetRate, budgetTotal };
}

export function getBalanceTrend(month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyInc    = dailyIncome(month, year);
  const dailyExp    = dailyExpenses(month, year);
  const labels      = [];
  const data        = [];
  let balance       = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    labels.push(d);
    balance += (dailyInc[d] || 0) - (dailyExp[d] || 0);
    data.push(parseFloat(balance.toFixed(2)));
  }
  return { labels, data };
}

export function searchTransactions(query, month, year) {
  const q       = query.toLowerCase().trim();
  const income  = getIncome()
    .filter(i => matchPeriod(i.date, month, year))
    .filter(i => !q || String(i.name || '').toLowerCase().includes(q) || String(i.notes || '').toLowerCase().includes(q))
    .map(i => ({ ...i, type: 'income' }));

  const expenses = getExpenses()
    .filter(i => matchPeriod(i.date, month, year))
    .filter(i => !q || String(i.name || '').toLowerCase().includes(q) || String(i.category || '').toLowerCase().includes(q))
    .map(i => ({ ...i, type: 'expense' }));

  return [...income, ...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/* ════════════════════════════════════════
   Smart Statistics (Advanced Metrics)
   ════════════════════════════════════════ */

export function getFinancialHealthScore(summary) {
  let score = 100;
  // 1. Saving rate
  if (summary.savingRate < 10) score -= 20;
  else if (summary.savingRate < 20) score -= 10;
  
  // 2. Budget adherence
  if (summary.budgetRate > 100) score -= 30;
  else if (summary.budgetRate > 80) score -= 10;
  
  // 3. Debt ratio
  const debtRatio = summary.income > 0 ? (summary.debts / summary.income) * 100 : 0;
  if (debtRatio > 50) score -= 40;
  else if (debtRatio > 30) score -= 20;
  
  return Math.max(0, Math.min(100, Math.floor(score)));
}

export function getSafeToSpend(summary, month, year) {
  const d = new Date();
  const currentMonth = d.getMonth() + 1;
  const currentYear = d.getFullYear();
  
  if (parseInt(month) !== currentMonth || parseInt(year) !== currentYear) {
    return 0; // Not applicable for past/future months
  }
  
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - d.getDate() + 1); // include today
  
  // Using remaining budget logic
  const budgetLeft = Math.max(0, summary.budgetTotal - summary.expenses);
  return budgetLeft / daysLeft;
}

export function getSmartInsight(summary, month, year) {
  if (summary.expenses === 0 && summary.income === 0) {
    return t('tip_no_data') || "Not enough data for this month. Start by adding income and expenses!";
  }
  if (summary.budgetRate > 100) {
    return t('tip_budget_over') || "You have exceeded your budget! Try to reduce your expenses.";
  }
  if (summary.savingRate >= 20) {
    return t('tip_excellent') || "Excellent performance! You are saving a large part of your income this month.";
  }
  if (summary.spendRate > 90) {
    return t('tip_warning') || "Warning: Your spending rate is very high and you may not have enough balance.";
  }
  
  const categories = expensesByCategory(month, year);
  const topCat = Object.keys(categories).sort((a,b) => categories[b] - categories[a])[0];
  if (topCat && categories[topCat] > (summary.expenses * 0.3)) {
    const catLabel = t((EXPENSE_CATEGORIES[topCat] || EXPENSE_CATEGORIES.other).label);
    return (t('tip_high_spend') || `The largest part of your money went to "${catLabel}". Make sure it's within your plan.`).replace('__CAT__', catLabel);
  }
  
  return t('tip_good') || "Your money distribution looks balanced. Keep tracking your budget!";
}
