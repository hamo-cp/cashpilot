/**
 * @module pages/dashboard
 * @description لوحة التحكم الرئيسية — Net Worth, Cash Flow, Quick Stats, Recent Tx.
 */

import { getState }              from '../core/state.js';
import { formatCurrency, formatPercent } from '../core/utils.js';
import * as Finance              from '../services/finance.js';
import { renderDonutChart }      from '../charts/charts.js';
import { txItemHTML, emptyStateHTML } from '../ui/components.js';

/** تحديث عنصر نصي بالمعرّف */
function set(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function renderDashboard() {
  const { filterMonth: m, filterYear: y } = getState();
  const summary = Finance.getMonthSummary(m, y);

  // Hero greeting
  const now      = new Date();
  const hour     = now.getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور';
  const dateStr  = now.toLocaleDateString('ar-EG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  set('dash-greeting',  greeting);
  set('dash-date',      dateStr);
  set('dash-net-balance', formatCurrency(summary.net));

  // Stats
  set('dash-income',      formatCurrency(summary.income));
  set('dash-expenses',    formatCurrency(summary.expenses));
  set('dash-debts',       formatCurrency(summary.debts));
  set('dash-investments', formatCurrency(summary.investments));
  set('dash-saving-rate', formatPercent(summary.savingRate));
  set('dash-spend-rate',  formatPercent(summary.spendRate) + ' من الدخل');

  // Net Worth row
  set('dash-assets',      formatCurrency(summary.income + summary.investments));
  set('dash-liabilities', formatCurrency(summary.expenses + summary.debts));

  // Cash Flow net
  const netEl = document.getElementById('dash-net');
  if (netEl) {
    netEl.textContent = formatCurrency(summary.net);
    netEl.style.color = summary.net >= 0
      ? 'var(--color-positive)' : 'var(--color-negative)';
  }

  // Cash Flow progress bar
  const spendBar = document.getElementById('dash-spend-bar');
  if (spendBar) {
    const pct   = Math.min(100, summary.spendRate);
    const color = pct >= 90
      ? 'var(--color-negative)'
      : pct >= 70 ? 'var(--color-warning)' : 'var(--color-positive)';
    spendBar.style.width      = pct + '%';
    spendBar.style.background = color;
  }

  // Hero balance colour
  const balEl = document.getElementById('dash-net-balance');
  if (balEl) {
    balEl.className = 'hero-balance ' + (summary.net >= 0 ? '' : 'amount-negative');
  }

  // Recent transactions
  const container = document.getElementById('recent-transactions');
  if (container) {
    const all = Finance.searchTransactions('', m, y).slice(0, 6);
    container.innerHTML = all.length
      ? all.map(txItemHTML).join('')
      : emptyStateHTML('ic-list', 'لا توجد معاملات', 'أضف دخلاً أو مصروفاً للبدء');
  }

  // Donut chart
  renderDonutChart(summary);
}
