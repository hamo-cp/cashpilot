/**
 * @module services/finance
 * @description طبقة المنطق المالي — Business Logic Layer.
 * تعتمد على storage/db فقط، لا تعرف شيئاً عن DOM أو UI.
 */

import * as DB from '../storage/db.js';
import { uid, today, matchPeriod } from '../core/utils.js';

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
  const result = {};
  getExpenses()
    .filter(i => matchPeriod(i.date, month, year))
    .forEach(i => {
      result[i.category] = (result[i.category] || 0) + (parseFloat(i.amount) || 0);
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
      result[day]   = (result[day] || 0) + (parseFloat(i.amount) || 0);
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
   الميزانية
   ════════════════════════════════════════ */

export function getBudget() {
  return DB.get(DB.KEYS.BUDGET) || {
    food: 0, transport: 0, education: 0, health: 0,
    entertainment: 0, shopping: 0, bills: 0, internet: 0,
  };
}

export function setBudget(budget) {
  DB.set(DB.KEYS.BUDGET, budget);
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
  const budgetRate  = budgetTotal > 0 ? Math.min(100, (expenses / budgetTotal) * 100) : 0;

  return { income, expenses, net, debts, investments, savingRate, spendRate, budgetRate, budgetTotal };
}

export function getBalanceTrend(month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyExp    = dailyExpenses(month, year);
  const totalInc    = totalIncome(month, year);
  const labels      = [];
  const data        = [];
  let balance       = totalInc;

  for (let d = 1; d <= daysInMonth; d++) {
    labels.push(d);
    if (d > 1) balance -= (dailyExp[d] || 0);
    data.push(parseFloat(balance.toFixed(2)));
  }
  return { labels, data };
}

export function searchTransactions(query, month, year) {
  const q       = query.toLowerCase().trim();
  const income  = getIncome()
    .filter(i => matchPeriod(i.date, month, year))
    .filter(i => !q || i.name.toLowerCase().includes(q) || (i.notes || '').toLowerCase().includes(q))
    .map(i => ({ ...i, type: 'income' }));

  const expenses = getExpenses()
    .filter(i => matchPeriod(i.date, month, year))
    .filter(i => !q || i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q))
    .map(i => ({ ...i, type: 'expense' }));

  return [...income, ...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
}
