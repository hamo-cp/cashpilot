/**
 * @module pages/dashboard
 * @description لوحة التحكم الرئيسية — Net Worth, Cash Flow, Quick Stats, Recent Tx.
 */

import { getState }              from '../core/state.js';
import { formatCurrency, formatPercent, animateValue } from '../core/utils.js';
import * as Finance              from '../services/finance.js';
import { renderDonutChart }      from '../charts/charts.js';
import { txItemHTML, emptyStateHTML } from '../ui/components.js';
import { t }                     from '../core/i18n.js';

/** تحديث عنصر نصي بالمعرّف */
function set(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/** تحريك الأرقام */
function setAnim(id, value, formatFn = formatCurrency) {
  const el = document.getElementById(id);
  if (el) animateValue(el, 0, value, 1200, formatFn);
}

export function renderDashboard() {
  const { filterMonth: m, filterYear: y } = getState();
  const summary = Finance.getMonthSummary(m, y);

  // Hero greeting
  const now      = new Date();
  const hour     = now.getHours();
  const greeting = hour < 12 ? t('greeting_am') : hour < 18 ? t('greeting_pm') : t('greeting_eve');
  const dateStr  = now.toLocaleDateString(t('locale'), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  set('dash-greeting',  greeting);
  set('dash-date',      dateStr);
  setAnim('dash-net-balance', summary.net);

  // Stats
  setAnim('dash-income',      summary.income);
  setAnim('dash-expenses',    summary.expenses);
  setAnim('dash-debts',       summary.debts);
  setAnim('dash-investments', summary.investments);
  setAnim('dash-saving-rate', summary.savingRate, formatPercent);
  setAnim('dash-spend-rate',  summary.spendRate, v => formatPercent(v) + ' ' + t('dash_spend_rate'));

  // Net Worth row
  setAnim('dash-assets',      summary.income + summary.investments);
  setAnim('dash-liabilities', summary.expenses + summary.debts);

  // Smart Insights & Safe to Spend
  const safeToSpend = Finance.getSafeToSpend(summary, m, y);
  setAnim('dash-safe-spend', safeToSpend);
  set('dash-smart-insight', Finance.getSmartInsight(summary, m, y));

  // Cash Flow net
  const netEl = document.getElementById('dash-net');
  if (netEl) {
    animateValue(netEl, 0, summary.net, 1200, formatCurrency);
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
      : emptyStateHTML('ic-list', t('empty_tx'), t('empty_tx_sub'));
  }

  // Donut chart
  renderDonutChart(summary);
}
